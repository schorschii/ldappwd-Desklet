#!/usr/bin/python3

from ldap3 import Server, Connection, ALL, ALL_ATTRIBUTES, BASE
import time
import sys


# 1st Parameter: LDAP Server Address
# 2nd Parameter: LDAP Bind Username
# 3rd Parameter: LDAP Bind Password
# 4th Parameter: LDAP Search Base
# 5th Parameter: sAMAccountName of expiry query user
if(len(sys.argv) != 6):
    print("Expecting 5 Parameters: expiry.py <Server Address> <Bind User> <Bind Password> <Search Base> <sAMAccountName>\n")
    exit(1)

def eprint(*args, **kwargs):
    print(*args, file=sys.stderr, **kwargs)

def escapeParam(str):
    return str.replace("(","\\28").replace(")","\\29")

pwdLastSetUnix = 0
maxPwdAgeSecs = 0

# connect to server
server = Server(sys.argv[1], use_ssl=True, get_info=ALL, connect_timeout=2)
conn = Connection(server, user=sys.argv[2], password=sys.argv[3], auto_bind=True, receive_timeout=2)

# query user pwdLastSet
conn.search(sys.argv[4], "(&(objectClass=user)(sAMAccountName="+escapeParam(sys.argv[5])+"))", attributes=ALL_ATTRIBUTES)
#print(conn.entries)
if(len(conn.entries) == 0):
    print("Error: User query produced no result")
    exit(1)
if(len(conn.entries) > 1):
    print("Error: User query produced more than one result")
    exit(1)

# check pwdLastSet value
pwdLastSet = conn.entries[0].pwdLastSet.value #datetime.datetime
pwdLastSetUnix = round(pwdLastSet.timestamp())
if(pwdLastSet == 0):
    print("Error: pwdLastSet is 0")
    exit(1)

# query domain password policy maxPwdAge
conn.search(sys.argv[4], "(objectClass=*)", search_scope=BASE, attributes=ALL_ATTRIBUTES)
#print(conn.entries)
if(len(conn.entries) != 1):
    print("Error: maxPwdAge query produced no entry or more than one entry")
    exit(1)

# check maxPwdAge value
maxPwdAge = conn.entries[0].maxPwdAge.value #datetime.timedelta
maxPwdAgeSecs = round(maxPwdAge.total_seconds())
if(pwdLastSet == 0):
    print("Error: pwsLastSet is 0")
    exit(1)

# calculate expiry
pwdExpiryUnix = pwdLastSetUnix + maxPwdAgeSecs
print(pwdExpiryUnix)

#pwdExpiryInSeconds = pwdExpiryUnix - round(time.time())
#pwdExpiryInDays = round(pwdExpiryInSeconds/60/60/24)
#print(pwdExpiryInDays)
