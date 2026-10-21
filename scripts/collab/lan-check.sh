#!/bin/sh
# Shows how to check, separately, that the iPhone reaches (1) Metro and
# (2) the local backend on this Mac. 127.0.0.1 on the iPhone is the iPhone
# itself, so the phone always needs this Mac's Wi-Fi address.
#   npm run collab:lan
. "$(dirname "$0")/_common.sh"
ip=$(lan_ip)
[ -n "$ip" ] || stop "no private Wi-Fi address on this Mac" "connect the Mac to the same Wi-Fi as the iPhone"
say "This Mac's Wi-Fi address now: $ip (it can change — re-run this when the network changes)"
say ""
say "1) Metro (needs collab:preview or collab:start running in another terminal)"
if curl -fsS -m 3 "http://$ip:8081/status" 2>/dev/null | grep -q running; then ok "Mac side: Metro answers on $ip:8081"; else warn "Mac side: Metro does not answer on $ip:8081 (not started, other port, or firewall)"; fi
say "   iPhone Safari: http://$ip:8081/status  → must show: packager-status:running"
say ""
say "2) Local backend (needs collab:start or a running tempa-local)"
code=$(curl -s -m 3 -o /dev/null -w '%{http_code}' "http://$ip:$LOCAL_API_PORT/auth/v1/health" 2>/dev/null)
case "$code" in 200|401) ok "Mac side: backend answers on $ip:$LOCAL_API_PORT (HTTP $code)";; *) warn "Mac side: backend does not answer on $ip:$LOCAL_API_PORT (HTTP ${code:-none})";; esac
say "   iPhone Safari: http://$ip:$LOCAL_API_PORT/auth/v1/health  → any short JSON reply (even \"No API key\") = reachable"
say ""
say "If the Mac side is OK but the iPhone is not: same Wi-Fi? Guest Wi-Fi often blocks devices; macOS Firewall may need to allow node / Docker."
