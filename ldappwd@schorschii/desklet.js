const Desklet = imports.ui.desklet;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Util = imports.misc.util;
const Mainloop = imports.mainloop;
const Lang = imports.lang;
const Settings = imports.ui.settings;
const Main = imports.ui.main;
const Clutter = imports.gi.Clutter;
const GdkPixbuf = imports.gi.GdkPixbuf;
const Cogl = imports.gi.Cogl;
const Gio = imports.gi.Gio;
const Tooltips = imports.ui.tooltips;

const DESKLET_ROOT = imports.ui.deskletManager.deskletMeta["ldappwd@schorschii"].path;


function MyDesklet(metadata, desklet_id) {
	this._init(metadata, desklet_id);
}

function main(metadata, desklet_id) {
	return new MyDesklet(metadata, desklet_id);
}

function getImageAtScale(imageFileName, width, height, width2 = 0, height2 = 0) {
	if (width2 == 0 || height2 == 0) {
		width2 = width;
		height2 = height;
	}

	let pixBuf = GdkPixbuf.Pixbuf.new_from_file_at_size(imageFileName, width, height);
	let image = new Clutter.Image();
	image.set_data(
		pixBuf.get_pixels(),
		pixBuf.get_has_alpha() ? Cogl.PixelFormat.RGBA_8888 : Cogl.PixelFormat.RGBA_888,
		width, height,
		pixBuf.get_rowstride()
	);

	let actor = new Clutter.Actor({width: width2, height: height2});
	actor.set_content(image);

	return actor;
}


MyDesklet.prototype = {
	__proto__: Desklet.Desklet.prototype,

	_init: function(metadata, desklet_id) {
		Desklet.Desklet.prototype._init.call(this, metadata);

		// initialize settings
		this.settings = new Settings.DeskletSettings(this, this.metadata["uuid"], desklet_id);
		this.settings.bindProperty(Settings.BindingDirection.IN, "hide-decorations", "hide_decorations", this.on_setting_changed);
		this.settings.bindProperty(Settings.BindingDirection.IN, "server-address", "serverAddress", this.on_setting_changed);
		this.settings.bindProperty(Settings.BindingDirection.IN, "server-username", "serverUsername", this.on_setting_changed);
		this.settings.bindProperty(Settings.BindingDirection.IN, "server-base-path", "serverBasePath", this.on_setting_changed);
		this.settings.bindProperty(Settings.BindingDirection.IN, "server-search-path", "serverSearchPath", this.on_setting_changed);
		this.settings.bindProperty(Settings.BindingDirection.IN, "server-query-user", "serverQueryUser", this.on_setting_changed);
		this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "last-pwdLastSet", "lastPwdLastSet", this.on_setting_changed);
		this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "last-pwdMaxAge", "lastPwdMaxAge", this.on_setting_changed);

		// initialize desklet gui
		this.setupUI();
	},

	setupUI: function() {
		// defaults and initial values
		this.deskletWidth = 120;
		this.info = "Please Refresh";
		this.symbol = "error";
		this.pwdMaxAge = this.lastPwdMaxAge;
		this.pwdLastSet = this.lastPwdLastSet;

		// set decoration settings
		this.refreshDecoration();

		// start update cycle
		this.refreshDesklet();
	},

	update: function(password) {
		this.pwdMaxAge = 0;
		this.pwdLastSet = 0;

		// get password last changed time
		let subprocess2 = new Gio.Subprocess({
			argv: [
				"/usr/bin/ldapsearch", "-LLL",
				"-h", this.serverAddress,
				"-x", "-D", this.serverUsername,
				"-w", password,
				"-b", this.serverSearchPath,
				"CN="+this.serverQueryUser,
				"pwdLastSet"
			],
			flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
		});
		subprocess2.init(null);
		let [, out2] = subprocess2.communicate_utf8(null, null); // get full output from stdout
		let lines2 = out2.split(/\r?\n/);
		for(var i=0; i<lines2.length; i++) {
			if(lines2[i].startsWith("pwdLastSet: ")) {
				this.pwdLastSet = lines2[i].split(" ")[1];
			}
		};

		// get password max age time
		let subprocess3 = new Gio.Subprocess({
			argv: [
				"/usr/bin/ldapsearch", "-LLL",
				"-h", this.serverAddress,
				"-x", "-D", this.serverUsername,
				"-w", password,
				"-b", this.serverBasePath,
				"CN=Builtin",
				"maxPwdAge"
			],
			flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
		});
		subprocess3.init(null);
		let [, out3] = subprocess3.communicate_utf8(null, null); // get full output from stdout
		let lines3 = out3.split(/\r?\n/);
		for(var i=0; i<lines3.length; i++) {
			if(lines3[i].startsWith("maxPwdAge: ")) {
				this.pwdMaxAge = lines3[i].split(" ")[1];
			}
		};

		// save result
		this.lastPwdMaxAge = this.pwdMaxAge;
		this.lastPwdLastSet = this.pwdLastSet;

		this.refreshDesklet();

		//Main.notifyError(result_devfile_capacity, result_devfile_status); // debug
	},

	refreshDesklet: function() {
		global.log("update");
		if(this.pwdMaxAge == 0 && this.pwdLastSet == 0) {
			if(this.serverAddress == "" || this.serverUsername == ""
			|| this.serverBasePath == "" || this.serverSearchPath == "" || this.serverQueryUser == "") {
				this.info = "Please Edit\nSettings";
				this.symbol = "error";
			} else {
				this.info = "Please Refresh";
				this.symbol = "error";
			}
		} else {
			// get current unix timestamp
			let subprocess = new Gio.Subprocess({
				argv: ["/bin/date", "+%s"],
				flags: Gio.SubprocessFlags.STDOUT_PIPE,
			});
			subprocess.init(null);
			let [, out] = subprocess.communicate_utf8(null, null); // get full output from stdout
			let currentUnixTime = out.split(/\r?\n/)[0]; // get first line

			// convert time format
			// divide by 10 000 000 to get seconds
			// 1.1.1600 -> 1.1.1970 = 11644473600 difference in seconds
			let pwdLastSetUnix = Math.round(Math.abs(parseInt(this.pwdLastSet) / 10000000)) - 11644473600;
			let pwdMaxAgeUnix = Math.round(Math.abs(parseInt(this.pwdMaxAge) / 10000000));
			let pwdExpiryUnix = pwdLastSetUnix + pwdMaxAgeUnix;
			let pwdExpiryInSeconds = pwdExpiryUnix - currentUnixTime;
			let pwdExpiryInDays = Math.round(pwdExpiryInSeconds/60/60/24);

			// check result
			if(pwdExpiryInDays > 0) {
				this.info = "" + pwdExpiryInDays + " days";
				if(pwdExpiryInDays > 14) {
					this.symbol = "green";
				} else if(pwdExpiryInDays > 5) {
					this.symbol = "yellow";
				} else {
					this.symbol = "red";
				}
			} else {
				this.info = "Password does\nnot expire";
			}
		}

		// icon
		let groupIcon = new St.Group();
		this.image = new St.Icon({
			gicon: new Gio.FileIcon({ file: Gio.file_new_for_path(DESKLET_ROOT + "/img/" + this.symbol + ".svg") }),
			icon_size: 48, icon_type: St.IconType.SYMBOLIC
		});
		this.image.set_position(this.deskletWidth/2 - 24,0);
		groupIcon.add_actor(this.image);
		new Tooltips.Tooltip(groupIcon, "Info");

		// label for percent string
		let labelText = new St.Label({style_class:"text"});
		labelText.set_position(0, 55);
		labelText.style = "width: " + this.deskletWidth.toString() + "px;";
		labelText.set_text(this.info);

		// refresh button
		let buttonRefresh = new St.Button({ style_class: "button" });
		this.image = new St.Icon({
			gicon: new Gio.FileIcon({ file: Gio.file_new_for_path(DESKLET_ROOT + "/img/refresh.svg") }),
			icon_size: 24, icon_type: St.IconType.SYMBOLIC
		});
		buttonRefresh.add_actor(this.image);
		new Tooltips.Tooltip(buttonRefresh, "Refresh Expiry Date");
		buttonRefresh.connect("clicked", Lang.bind(this, this.refreshPasswordExpiry));

		// set password button
		let buttonSetPassword = new St.Button({ style_class: "button" });
		this.image = new St.Icon({
			gicon: new Gio.FileIcon({ file: Gio.file_new_for_path(DESKLET_ROOT + "/img/setpwd.svg") }),
			icon_size: 24, icon_type: St.IconType.SYMBOLIC
		});
		buttonSetPassword.add_actor(this.image);
		new Tooltips.Tooltip(buttonSetPassword, "Set New Password");
		buttonSetPassword.connect("clicked", Lang.bind(this, this.setPassword));

		// create table layout
		let buttonTable = new Clutter.TableLayout();
		let buttonTableActor = new Clutter.Actor();
		buttonTableActor.set_layout_manager(buttonTable);
		buttonTable.set_column_spacing(5);
		buttonTable.pack(buttonRefresh, 0, 0);
		buttonTable.pack(buttonSetPassword, 1, 0);

		let layoutTable = new Clutter.TableLayout();
		this.container = new Clutter.Actor();
		this.container.set_layout_manager(layoutTable);
		layoutTable.set_row_spacing(5);
		layoutTable.pack(groupIcon, 0, 0);
		layoutTable.pack(labelText, 0, 1);
		layoutTable.pack(buttonTableActor, 0, 2);

		// set root element
		this.setContent(this.container);

		// refresh again
		if(typeof this.timeout !== 'undefined') {
			Mainloop.source_remove(this.timeout);
		}
		this.timeout = Mainloop.timeout_add_seconds(50, Lang.bind(this, this.refreshDesklet));
	},

	refreshPasswordExpiry: function() {
		let subprocess = new Gio.Subprocess({
			argv: ["/usr/bin/zenity", "--password", "--title", "LDAP Password"],
			flags: Gio.SubprocessFlags.STDOUT_PIPE,
		});
		subprocess.init(null);
		subprocess.desklet = this;
		subprocess.wait_async(null, this.askPasswordCallback);
	},

	askPasswordCallback: function(sourceObject, res) {
		let [, out] = sourceObject.communicate_utf8(null, null);
		if(out.trim() != "") {
			sourceObject.desklet.update(out.trim());
		}
	},

	setPassword: function() {
		let subprocess = new Gio.Subprocess({
			argv: [
				"/usr/bin/zenity", "--forms",
				"--title", "New LDAP Password",
				"--text", "Change Password",
				"--add-password", "Old Password",
				"--add-password", "New Password",
				"--add-password", "Confirm Password"
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
				// update password
				let subprocess = new Gio.Subprocess({
					argv: [
						"/usr/bin/python3", DESKLET_ROOT+"/ldappasswd.py",
						sourceObject.desklet.serverAddress,
						sourceObject.desklet.serverUsername,
						oldPassword,
						"CN="+sourceObject.desklet.serverQueryUser+","+sourceObject.desklet.serverSearchPath,
						oldPassword,
						newPassword
					],
					flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
				});
				subprocess.init(null);
				let [, out] = subprocess.communicate_utf8(null, null); // get full output from stdout
				if(out.includes("'description': 'success'")) {
					let subprocess = new Gio.Subprocess({
						argv: [
							"/usr/bin/zenity", "--info",
							"--title", "LDAP Password Changed",
							"--text", "New passwords set successfully."
						],
						flags: Gio.SubprocessFlags.STDOUT_PIPE,
					});
					subprocess.init(null);
				} else {
					let subprocess = new Gio.Subprocess({
						argv: [
							"/usr/bin/zenity", "--error",
							"--title", "LDAP Password Change Error",
							"--text", out
						],
						flags: Gio.SubprocessFlags.STDOUT_PIPE,
					});
					subprocess.init(null);
				}
				// update expiry date
				sourceObject.desklet.update(newPassword);
			} else {
				let subprocess = new Gio.Subprocess({
					argv: [
						"/usr/bin/zenity", "--warning",
						"--title", "New LDAP Password",
						"--text", "New passwords not matching."
					],
					flags: Gio.SubprocessFlags.STDOUT_PIPE,
				});
				subprocess.init(null);
			}
		}
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
