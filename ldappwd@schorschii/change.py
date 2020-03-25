#!/usr/bin/python3

from ldap3 import Server, Connection, ALL, ALL_ATTRIBUTES, BASE
import sys


# 1st Parameter: LDAP Server Address
# 2nd Parameter: LDAP Bind Username
# 3rd Parameter: LDAP Bind Password
# 4th Parameter: LDAP Search Base
# 5th Parameter: Password Modify Username
# 6th Parameter: User's Old Password
# 7th Parameter: User's New Password
if(len(sys.argv) != 8):
    print("Expecting 7 Parameters: change.py <Server Address> <Bind User> <Search Base> <Bind Password> <Modify User's DN> <Old Password> <New Password>\n")
    exit(1)

def escapeParam(str):
    return str.replace("(","\\28").replace(")","\\29")

# connect to server
server = Server(sys.argv[1], use_ssl=True, get_info=ALL)
conn = Connection(server, user=sys.argv[2], password=sys.argv[3], auto_bind=True)

# query user dn
userDn = None
conn.search(sys.argv[4], "(&(objectClass=user)(sAMAccountName="+escapeParam(sys.argv[5])+"))", attributes=ALL_ATTRIBUTES)
if(len(conn.entries) == 0):
    print("Error: User query produced no result")
    exit(1)
if(len(conn.entries) > 1):
    print("Error: User query produced more than one result")
    exit(1)
userDn = conn.entries[0].distinguishedName.value

# change password - microsoft style
conn.extend.microsoft.modify_password(user=userDn, new_password=sys.argv[6], old_password=sys.argv[5])
print(conn.result)
