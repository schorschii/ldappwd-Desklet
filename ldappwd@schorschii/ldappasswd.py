#!/usr/bin/python3

from ldap3 import Server, Connection, ALL
import sys


# 1st Parameter: LDAP Server Address
# 2nd Parameter: LDAP Bind User
# 3rd Parameter: LDAP Bind Password
# 4th Parameter: Password Modify User DN
# 5th Parameter: User's Old Password
# 6th Parameter: User's New Password
if(len(sys.argv) != 7):
    print("Expecting 6 Parameters!\n")
    exit(1)

server = Server(sys.argv[1], use_ssl=True, get_info=ALL)
conn = Connection(server, user=sys.argv[2], password=sys.argv[3], auto_bind=True)
print(conn)

conn.extend.microsoft.modify_password(user=sys.argv[4], new_password=sys.argv[6], old_password=sys.argv[5])
print(conn.result)
