# LDAP Password Expiry Desklet for the Cinnamon Desktop
This desklet shows when your LDAP domain password expires. Additionally, you can change it directly with a click on the desklet.

It currently only supports the Microsoft Active Directory LDAP server. Feedback & contributions welcome!

This desklet is currenty in BETA phase and therefore not yet in the official cinnamon spices repo.

![Screenshot](https://raw.githubusercontent.com/schorschii/ldappwd-desklet/master/ldappwd%40schorschii/img/screenshot.png)

## 1. Installation
### Debian Package Installation (Debian/Ubuntu/Mint)
1. Download and install the `.deb` package from the [latest release](https://github.com/schorschii/ldappwd-desklet/releases) on Github.
2. Right click on your cinnamon desktop and add the desklet to your desktop. Continue with "**2. Desklet Setup**".

### Manual Installation
1. Copy `ldappwd@schorschii` dir into `~/.local/share/cinnamon/desklets`
2. Install the required packages
```
apt install python3-pip python3-gssapi zenity
pip3 install ldap3
```
3. (Optional) Install translation files
```
cd ~/.local/share/cinnamon/desklets/ldappwd@schorschii
cinnamon-json-makepot --install
```

## 2. Desklet Setup
1. Open the desklet manager and add the desklet to your desktop. Right click on it and open the desklet settings. It tries to automatically find out the correct values. Check and correct them if necessary.  
**Example Values**  
LDAP Server Address: `192.168.56.101`  
Username: `johndoe`  
Domain: `example.com`  

2. Click the "Refresh" Button on the desklet and enter the password for the LDAP bind user to authenticate against the LDAP server.  
If everything was entered correct, the desklet now displays when the password of the given user expires.

3. You can click the "Set New Password" button on the desklet to change your password directly.
