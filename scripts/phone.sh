#!/usr/bin/env bash
# Prints every address the dev server is reachable on, with a QR code to scan.
# Usage:  npm run phone            (after `npm run dev` is running)
#         npm run phone -- 4173    (for `npm run preview`)
set -uo pipefail

PORT="${1:-5173}"
bold() { printf '\033[1m%s\033[0m\n' "$1"; }
dim()  { printf '\033[2m%s\033[0m\n' "$1"; }

if ! ss -ltn "sport = :$PORT" 2>/dev/null | grep -q ":$PORT"; then
  bold "Nothing is listening on port $PORT."
  dim  "Start it first:  npm run dev"
  exit 1
fi

label_for() {
  case "$1" in
    zt*)       echo "ZeroTier  (works off this network)" ;;
    wl*|wlan*) echo "Wi-Fi     (same network only; campus wifi often blocks this)" ;;
    en*|eth*)  echo "Ethernet  (same network only)" ;;
    *)         echo "$1" ;;
  esac
}

primary=""
bold "Dev server — port $PORT"
echo
while read -r iface addr; do
  ip="${addr%%/*}"
  url="http://$ip:$PORT"
  printf '  \033[1m%-28s\033[0m %s\n' "$url" "$(label_for "$iface")"
  [[ -z "$primary" || "$iface" == zt* ]] && primary="$url"
done < <(ip -4 -o addr show scope global | awk '{print $2, $4}')
echo
printf '  \033[1m%-28s\033[0m %s\n' "http://localhost:$PORT" "this machine"
echo

if command -v qrencode >/dev/null; then
  bold "Scan on your phone  ->  $primary"
  echo
  qrencode -t ANSIUTF8 -m 2 "$primary"
else
  dim "Install qrencode for a scannable code:  sudo apt install -y qrencode"
fi
