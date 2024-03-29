const Desklet = imports.ui.desklet;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const Lang = imports.lang;
const Settings = imports.ui.settings;
const Main = imports.ui.main;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const PopupMenu = imports.ui.popupMenu;
const Tooltips = imports.ui.tooltips;
const Gettext = imports.gettext;

const UUID = "ldappwd@schorschii";
const DESKLET_ROOT = imports.ui.deskletManager.deskletMeta[UUID].path;

// translation support
function _(str) {
	return Gettext.dgettext(UUID, str);
}

function MyDesklet(metadata, desklet_id) {
	// translation init: if installed in user context, switch to translations in user's home dir
	if(!DESKLET_ROOT.startsWith("/usr/share/")) {
		Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");
	}
	this._init(metadata, desklet_id);
}

function main(metadata, desklet_id) {
	return new MyDesklet(metadata, desklet_id);
}

function buildBasePathByDomain(domain) {
	var basePathParts = [];
	var a = domain.split(".");
	for(var i = 0; i < a.length; i++) {
		basePathParts.push("dc="+a[i]);
	}
	return basePathParts.join(",");
}


MyDesklet.prototype = {
	__proto__: Desklet.Desklet.prototype,

	_init: function(metadata, desklet_id) {
		Desklet.Desklet.prototype._init.call(this, metadata);

		// initialize settings
		this.settings = new Settings.DeskletSettings(this, this.metadata["uuid"], desklet_id);
		this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "server-address", "serverAddress", this.on_setting_changed);
		this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "server-username", "serverUsername", this.on_setting_changed);
		this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "server-domain", "serverDomain", this.on_setting_changed);
		this.settings.bindProperty(Settings.BindingDirection.IN, "kerberos-authentication", "kerberosAuthentication", this.on_setting_changed);
		this.settings.bindProperty(Settings.BindingDirection.IN, "fallback-password-authentication", "fallbackPasswordAuthentication", this.on_setting_changed);
		this.settings.bindProperty(Settings.BindingDirection.IN, "show-notifications", "showNotifications", this.on_setting_changed);
		this.settings.bindProperty(Settings.BindingDirection.IN, "show-buttons", "showButtons", this.on_setting_changed);
		this.settings.bindProperty(Settings.BindingDirection.IN, "hide-decorations", "hide_decorations", this.on_setting_changed);
		this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "last-pwdExpiry", "lastPwdExpiry", this.on_setting_changed);

		// try to get useful values if settings are empty
		if(this.serverAddress == "" && this.serverUsername == "" && this.serverDomain == "") {
			this.tryGetSettingsFromSystem();
		}

		// initialize desklet gui
		this.setupUI();
	},

	setupUI: function() {
		// defaults and initial values
		this.deskletWidth = 120;
		this.info = _("Please Refresh");
		this.symbol = "error";
		this.pwdExpiry = this.lastPwdExpiry;

		// set decoration settings
		this.refreshDecoration();

		// init context menu
		this.populateContextMenu();

		// start update cycle
		this.refreshDesklet(true);
	},

	tryGetSettingsFromSystem: function() {
		try {
			// user name
			let subprocess = new Gio.Subprocess({
				argv: ["/usr/bin/whoami"],
				flags: Gio.SubprocessFlags.STDOUT_PIPE,
			});
			subprocess.init(null);
			subprocess.wait_async(null, (sourceObject, res) => {
				let [, out] = sourceObject.communicate_utf8(null, null);
				this.serverUsername = out.trim();
			});

			// domain name
			let fileDomain = Gio.file_new_for_path("/etc/resolv.conf");
			fileDomain.load_contents_async(null, (file, response) => {
				try {
					let [success, contents, tag] = file.load_contents_finish(response);
					if(success) {
						let lines = contents.toString().split("\n");
						for(var i = 0; i < lines.length; i++) {
							if(lines[i].trim().startsWith("search ")) {
								this.serverDomain = lines[i].split(" ")[1].trim()
							}
						}
					}
					GLib.free(contents);
				} catch(err) {
					this.currentError = 1;
				}
				this.refreshDesklet();
			});

			// ldap server (domain controller) via Samba config
			let fileSmbConf = Gio.file_new_for_path("/etc/samba/smb.conf");
			fileSmbConf.load_contents_async(null, (file, response) => {
				try {
					let [success, contents, tag] = file.load_contents_finish(response);
					if(success) {
						let lines = contents.toString().split("\n");
						for(var i = 0; i < lines.length; i++) {
							if(lines[i].trim().startsWith("password server = ")) {
								this.serverAddress = "ldaps://"+lines[i].trim().split(" ")[3].trim().split(",")[0].trim();
							}
						}
					}
					GLib.free(contents);
				} catch(err) {
					this.currentError = 1;
				}
				this.refreshDesklet();
			});

			// ldap server (domain controller) via krb config
			let fileKrbConf = Gio.file_new_for_path("/etc/krb5.conf");
			fileKrbConf.load_contents_async(null, (file, response) => {
				try {
					let [success, contents, tag] = file.load_contents_finish(response);
					if(success) {
						let lines = contents.toString().split("\n");
						for(var i = 0; i < lines.length; i++) {
							if(lines[i].trim().startsWith("kdc = ")) {
								this.serverAddress = "ldaps://"+lines[i].trim().split(" ")[2].trim();
							}
						}
					}
					GLib.free(contents);
				} catch(err) {
					this.currentError = 1;
				}
				this.refreshDesklet();
			});
		} catch(ex) {}
	},

	populateContextMenu: function() {
		this.refreshMenuItem = new PopupMenu.PopupMenuItem(_("Refresh Expiry Date"));
		this._menu.addMenuItem(this.refreshMenuItem);
		this.refreshMenuItem.connect("activate", Lang.bind(this, Lang.bind(this, this.onClickRefreshPasswordExpiry)));

		this.setMenuItem = new PopupMenu.PopupMenuItem(_("Set New Password"));
		this._menu.addMenuItem(this.setMenuItem);
		this.setMenuItem.connect("activate", Lang.bind(this, Lang.bind(this, this.setPassword)));
	},

	update: function(password) {
		this.pwdExpiry = 0;

		// get password last changed time
		let subprocess2 = new Gio.Subprocess({
			argv: [
				"/usr/bin/python3", DESKLET_ROOT+"/expiry.py",
				this.serverAddress,
				this.serverUsername+"@"+this.serverDomain,
				password,
				buildBasePathByDomain(this.serverDomain),
				this.serverUsername
			],
			flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
		});
		subprocess2.init(null);
		let [, out2, err2] = subprocess2.communicate_utf8(null, null); // get full output from stdout
		let lines2 = out2.split(/\r?\n/);
		for(var i=0; i<lines2.length; i++) {
			var parsed = parseInt(lines2[i]);
			if(lines2[i].trim() != "" && !isNaN(parsed)) {
				this.pwdExpiry = parsed;
			}
		};
		if(this.pwdExpiry == 0) {
			if(password == "" && this.fallbackPasswordAuthentication) {
				// kerberos auth failed - try with password
				Main.notifyError(_("Cannot query pwdExpiry!"), err2.toString());
				this.refreshPasswordExpiry(true);
			} else {
				// password auth failed - show error message
				this.showMessageBox("error", _("Cannot query pwdExpiry!"), this.escapeString(err2.toString()));
			}
		}

		// save result in settings
		this.lastPwdExpiry = this.pwdExpiry;

		// refresh view
		this.refreshDesklet();
	},

	refreshDesklet: function(showNotifications = false) {
		if(this.pwdExpiry == 0) {
			if(this.serverAddress == "" || this.serverUsername == "" || this.serverDomain == "") {
				this.info = _("Please Edit\nSettings");
				this.symbol = "error";
			} else {
				this.info = _("Please Refresh");
				this.symbol = "error";
			}
		} else {
			// recalc expiration days
			let pwdExpiryInSeconds = this.pwdExpiry - Math.round(Date.now()/1000);
			let pwdExpiryInDays = Math.round(pwdExpiryInSeconds/60/60/24);

			// check result
			if(pwdExpiryInDays > 0) {
				this.info = this.serverUsername + "\n" + pwdExpiryInDays + " " + _("days");
				if(pwdExpiryInDays > 14) {
					this.symbol = "green";
				} else if(pwdExpiryInDays > 5) {
					this.symbol = "yellow";
				} else {
					this.symbol = "red";
					if(showNotifications) {
						Main.notifyError(this.serverUsername, _("Your password expires in % days").replace("%", pwdExpiryInDays));
					}
				}
			} else {
				this.info = _("Password does\nnot expire");
			}
		}

		// icon
		let groupIcon = new St.Group();
		this.image = new St.Icon({
			gicon: new Gio.FileIcon({ file: Gio.file_new_for_path(DESKLET_ROOT + "/img/" + this.symbol + ".svg") }),
			icon_size: 48, icon_type: St.IconType.SYMBOLIC
		});
		this.image.set_position((this.deskletWidth*global.ui_scale)/2 - (24*global.ui_scale), 0);
		groupIcon.add_actor(this.image);

		// label for percent string
		let labelText = new St.Label({style_class:"text"});
		labelText.style = "width: " + this.deskletWidth.toString() + "px;";
		labelText.set_text(this.info);

		// refresh button
		let buttonRefresh = new St.Button({ style_class: "button" });
		this.image = new St.Icon({
			gicon: new Gio.FileIcon({ file: Gio.file_new_for_path(DESKLET_ROOT + "/img/refresh.svg") }),
			icon_size: 24, icon_type: St.IconType.SYMBOLIC
		});
		buttonRefresh.add_actor(this.image);
		new Tooltips.Tooltip(buttonRefresh, _("Refresh Expiry Date"));
		buttonRefresh.connect("clicked", Lang.bind(this, this.onClickRefreshPasswordExpiry));

		// set password button
		let buttonSetPassword = new St.Button({ style_class: "button" });
		this.image = new St.Icon({
			gicon: new Gio.FileIcon({ file: Gio.file_new_for_path(DESKLET_ROOT + "/img/setpwd.svg") }),
			icon_size: 24, icon_type: St.IconType.SYMBOLIC
		});
		buttonSetPassword.add_actor(this.image);
		new Tooltips.Tooltip(buttonSetPassword, _("Set New Password"));
		buttonSetPassword.connect("clicked", Lang.bind(this, this.setPassword));

		// create table layout
		let buttonTable = new Clutter.GridLayout();
		let buttonTableActor = new Clutter.Actor();
		buttonTableActor.set_layout_manager(buttonTable);
		buttonTable.set_column_spacing(4);
		buttonTable.attach(buttonRefresh, 0, 0, 1, 1);
		buttonTable.attach(buttonSetPassword, 1, 0, 1, 1);

		// set root element
		this.container = new St.BoxLayout({ style_class: "container", vertical: true });
		this.setContent(this.container);
		this.container.add_actor(groupIcon);
		this.container.add_actor(labelText);
		if(this.showButtons) {
			this.container.add_actor(buttonTableActor);
		}

		// refresh again
		if(typeof this.timeout !== 'undefined') {
			Mainloop.source_remove(this.timeout);
		}
		this.timeout = Mainloop.timeout_add_seconds(600, Lang.bind(this, this.refreshDesklet));
	},

	onClickRefreshPasswordExpiry: function() {
		// proxy function for executing refreshPasswordExpiry() via clicking a button
		// - some other parameters are passed then, which should not be passed to refreshPasswordExpiry()
		this.refreshPasswordExpiry();
	},

	refreshPasswordExpiry: function(forceSimpleBind = false) {
		if(this.serverAddress == "" || this.serverUsername == "" || this.serverDomain == "") {
			return;
		}
		if(this.kerberosAuthentication && !forceSimpleBind) {
			this.update("");
		} else {
			let subprocess = new Gio.Subprocess({
				argv: ["/usr/bin/zenity", "--password", "--title", _("LDAP Password for »%«").replace("%", this.serverUsername)],
				flags: Gio.SubprocessFlags.STDOUT_PIPE,
			});
			subprocess.init(null);
			subprocess.desklet = this;
			subprocess.wait_async(null, this.askPasswordCallback);
		}
	},

	askPasswordCallback: function(sourceObject, res) {
		let [, out] = sourceObject.communicate_utf8(null, null);
		if(out.trim() != "") {
			sourceObject.desklet.update(out.trim());
		}
	},

	setPassword: function() {
		if(this.serverAddress == "" || this.serverUsername == "" || this.serverDomain == "") {
			return;
		}
		let subprocess = new Gio.Subprocess({
			argv: [
				"/usr/bin/zenity", "--forms",
				"--title", _("New Password for »%«").replace("%", this.serverUsername),
				"--text", _("Change Password"),
				"--add-password", _("Old Password"),
				"--add-password", _("New Password"),
				"--add-password", _("Confirm Password")
			],
			flags: Gio.SubprocessFlags.STDOUT_PIPE,
		});
		subprocess.init(null);
		subprocess.desklet = this;
		subprocess.wait_async(null, this.setPasswordCallback);
	},

	setPasswordCallback: function(sourceObject, res) {
		let [, out] = sourceObject.communicate_utf8(null, null);
		let splitter = out.split('|');
		if(splitter.length == 3) {
			let oldPassword = splitter[0].trim();
			let newPassword = splitter[1].trim();
			let confirmPassword = splitter[2].trim();
			if(newPassword == confirmPassword) {
				if(sourceObject.desklet.kerberosAuthentication) {
					sourceObject.desklet.updatePassword("", oldPassword, newPassword);
				} else {
					sourceObject.desklet.updatePassword(oldPassword, oldPassword, newPassword);
				}

			} else {
				sourceObject.desklet.showMessageBox("warning", _("New Password"), _("New passwords not matching."));
			}
		}
	},

	updatePassword: function(bindPassword, oldPassword, newPassword) {
		let subprocess = new Gio.Subprocess({
			argv: [
				"/usr/bin/python3", DESKLET_ROOT+"/change.py",
				this.serverAddress,
				this.serverUsername+"@"+this.serverDomain,
				bindPassword,
				buildBasePathByDomain(this.serverDomain),
				this.serverUsername,
				oldPassword,
				newPassword
			],
			flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
		});
		subprocess.init(null);
		let [, out, err] = subprocess.communicate_utf8(null, null); // get full output from stdout
		if(out.includes("'description': 'success'")) {
			this.showMessageBox("info", _("LDAP Password Changed"), _("New password set successfully."));
			// update expiry date
			if(this.kerberosAuthentication) {
				this.update("");
			} else {
				this.update(newPassword);
			}
		} else {
			if(bindPassword == "" && this.fallbackPasswordAuthentication) {
				// kerberos auth failed - try with password auth
				Main.notifyError(_("LDAP Password Change Error"), err.toString());
				this.updatePassword(oldPassword, oldPassword, newPassword);
			} else {
				this.showMessageBox("error", _("LDAP Password Change Error"),
					_("Please check if old password is correct, new password conforms to password policy, minimum password age is not violated, and that your account is not locked.")
					+ "\n\n" + "Error Details: " + this.escapeString(out.toString())
					+ "\n" + this.escapeString(err.toString())
				);
			}
		}
	},

	showMessageBox: function(icon, title, text) {
		let subprocess = new Gio.Subprocess({
			argv: [
				"/usr/bin/zenity", "--"+icon, "--width=400",
				"--title", title,
				"--text", text
			],
			flags: Gio.SubprocessFlags.STDOUT_PIPE,
		});
		subprocess.init(null);
	},

	escapeString: function(input) {
		return input.replace(/[^\w\s/():,.\n]/gi, '');
	},

	refreshDecoration: function() {
		// desklet label (header)
		this.setHeader(_("Password Expiry"));

		// prevent decorations?
		this.metadata["prevent-decorations"] = this.hide_decorations;
		this._updateDecoration();
	},

	on_setting_changed: function() {
		// update decoration settings and refresh desklet content
		this.refreshDecoration();
		this.refreshDesklet();
	},

	on_desklet_clicked: function() {
	},

	on_desklet_removed: function() {
		Mainloop.source_remove(this.timeout);
	}
}
