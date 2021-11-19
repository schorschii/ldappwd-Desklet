#!/usr/bin/python3

import ldap3
import sys


# 1st Parameter: LDAP Server Address/URL (ldap://10.1.1.1 or ldaps://10.1.1.1)
# 2nd Parameter: LDAP Bind Username
# 3rd Parameter: LDAP Bind Password
# 4th Parameter: LDAP Search Base
# 5th Parameter: Password Modify Username
# 6th Parameter: User's Old Password
# 7th Parameter: User's New Password
if(len(sys.argv) != 8):
    print("Expecting 7 Parameters: change.py <Server URL> <Bind User> <Search Base> <Bind Password> <Modify User's DN> <Old Password> <New Password>\n")
    exit(1)

def eprint(*args, **kwargs):
    print(*args, file=sys.stderr, **kwargs)

def escapeParam(str):
    return str.replace("(","\\28").replace(")","\\29")

# connect to server
server = ldap3.Server(sys.argv[1], get_info=ldap3.ALL, connect_timeout=2)
conn = None

# try bind using Kerberos ticket
try:
	if(sys.argv[3] == ''):
		conn = ldap3.Connection(server,
			authentication=ldap3.SASL,
			sasl_mechanism=ldap3.KERBEROS,
			auto_bind=True,
			receive_timeout=2
		)
except Exception as e:
	eprint('Unable to bind via Kerberos: '+str(e))
	sys.exit(1)

# bind using username and password
try:
	if(conn == None):
		conn = ldap3.Connection(server,
			user=sys.argv[2],
			password=sys.argv[3],
			auto_bind=True,
			receive_timeout=2
		)
except Exception as e:
	eprint('Unable to bind using password: '+str(e))
	sys.exit(1)

# query user dn
userDn = None
conn.search(sys.argv[4],
	"(&(objectClass=user)(sAMAccountName="+escapeParam(sys.argv[5])+"))",
	attributes=ldap3.ALL_ATTRIBUTES
)
if(len(conn.entries) == 0):
    eprint("Error: User query produced no result")
    exit(1)
if(len(conn.entries) > 1):
    eprint("Error: User query produced more than one result")
    exit(1)
userDn = conn.entries[0].distinguishedName.value
#print(userDn)

# change password - microsoft style
conn.extend.microsoft.modify_password(
	user=userDn,
	new_password=sys.argv[7],
	old_password=sys.argv[6]
)
print(conn.result)
