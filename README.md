# LDAP Password Expiry Desklet for the Cinnamon Desktop
This desklet shows when your LDAP domain password expires. Additionally, you can change it directly with a click on the desklet.

It currently only supports the Microsoft Active Directory LDAP server. Feedback & contributions welcome!

This desklet is currenty in BETA phase and therefore not yet in the official cinnamon spices repo.

![Screenshot](https://raw.githubusercontent.com/schorschii/ldappwd-desklet/master/ldappwd%40schorschii/img/screenshot.png)

## Installation
1. Copy `ldappwd@schorschii` dir into `~/.local/share/cinnamon/desklets`

2. Install the required packages
```
apt install ldap-utils python3-pip zenity
pip3 install ldap3
```

3. Add the desklet to your desktop and go to settings.  
**Example Values**  
LDAP Server Address: `192.168.56.101`  
LDAP Bind User: `hwurst@example.com`  
LDAP Base Path: `dc=example,dc=com`  
LDAP Path of the User to Check: `ou=persons,dc=example,dc=com`  
Common Name of the User to Check: `Hans Wurst` or `hwurst`

4. Click the "Refresh" Button and enter the password for the LDAP bind user to authenticate against the LDAP server.  
If everything was entered correct, the desklet should now display when the password of the given user expires.

5. You can click on "Set New Password" to change your password directly.
