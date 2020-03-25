# LDAP Password Expiry Desklet for the Cinnamon Desktop
This desklet shows when your LDAP domain password expires. Additionally, you can change it directly with a click on the desklet.

It currently only supports the Microsoft Active Directory LDAP server. Feedback & contributions welcome!

This desklet is currenty in BETA phase and therefore not yet in the official cinnamon spices repo.

![Screenshot](https://raw.githubusercontent.com/schorschii/ldappwd-desklet/master/ldappwd%40schorschii/img/screenshot.png)

## Manual Installation
1. Copy `ldappwd@schorschii` dir into `~/.local/share/cinnamon/desklets`
2. Install the required packages
```
apt install python3-pip zenity
pip3 install ldap3
```
3. (Optional) Install translation files
```
cd ~/.local/share/cinnamon/desklets/ldappwd@schorschii
cinnamon-json-makepot --install
```

## Desklet Setup
1. Open the desklet manager and add the desklet to your desktop. Right click on it and open settings.  
**Example Values**  
LDAP Server Address: `192.168.56.101`  
Username: `johndoe`  
Domain: `example.com`  

2. Click the "Refresh" Button on the desklet and enter the password for the LDAP bind user to authenticate against the LDAP server.  
If everything was entered correct, the desklet now displays when the password of the given user expires.

3. You can click the "Set New Password" button on the desklet to change your password directly.
