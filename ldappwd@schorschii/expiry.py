#!/usr/bin/python3

import datetime
import ldap3
import time
import sys


# 1st Parameter: LDAP Server Address/URL (ldap://10.1.1.1 or ldaps://10.1.1.1)
# 2nd Parameter: LDAP Bind Username
# 3rd Parameter: LDAP Bind Password (leave empty for Kerberos auth)
# 4th Parameter: LDAP Search Base
# 5th Parameter: sAMAccountName of expiry query user
if(len(sys.argv) != 6):
    eprint("Expecting 5 Parameters: expiry.py <Server URL> <Bind User> <Bind Password> <Search Base> <sAMAccountName>\n")
    sys.exit(1)

def eprint(*args, **kwargs):
    print(*args, file=sys.stderr, **kwargs)

def escapeParam(str):
    return str.replace("(","\\28").replace(")","\\29")

pwdLastSetUnixSecs = 0
maxPwdAgeSecs = 0

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
	pass

# bind using username and password
if(conn == None):
	conn = ldap3.Connection(server,
		user=sys.argv[2],
		password=sys.argv[3],
		auto_bind=True,
		receive_timeout=2
	)

# query user pwdLastSet
conn.search(sys.argv[4],
	"(&(objectClass=user)(sAMAccountName="+escapeParam(sys.argv[5])+"))",
	attributes=ldap3.ALL_ATTRIBUTES
)
if(len(conn.entries) == 0):
    eprint("Error: User query produced no result entry")
    sys.exit(1)
if(len(conn.entries) > 1):
    eprint("Error: User query produced more than one result entry")
    sys.exit(1)

# check pwdLastSet value
pwdLastSet = conn.entries[0].pwdLastSet.value #datetime.datetime
pwdLastSetUnixSecs = round(pwdLastSet.timestamp()) if type(pwdLastSet) is datetime.datetime else int(pwdLastSet)
if(pwdLastSetUnixSecs == 0):
    eprint("Error: pwdLastSet is 0")
    sys.exit(1)

# query domain password policy maxPwdAge
conn.search(sys.argv[4],
	"(objectClass=*)",
	search_scope=ldap3.BASE,
	attributes=ldap3.ALL_ATTRIBUTES
)
if(len(conn.entries) != 1):
    eprint("Error: maxPwdAge query produced no or more than one result entry")
    sys.exit(1)

# check maxPwdAge value
maxPwdAge = conn.entries[0].maxPwdAge.value #datetime.timedelta
maxPwdAgeSecs = round(maxPwdAge.total_seconds()) if type(maxPwdAge) is datetime.timedelta else int(maxPwdAge)
if(maxPwdAgeSecs <= 0):
    eprint("Error: maxPwdAge is 0")
    sys.exit(1)

# calculate expiry
pwdExpiryUnix = pwdLastSetUnixSecs + maxPwdAgeSecs
print(pwdExpiryUnix)
sys.exit(0)

