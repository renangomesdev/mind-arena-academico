#!/bin/sh
set -eu

# A configuração local não usa o modelo HTTPS de produção.
if [ ! -f /etc/nginx/templates/default.conf.template ]; then
    exit 0
fi

case "${DOMAIN_NAME:-}" in
    ""|*[!A-Za-z0-9.-]*|.*|*.|*..*)
        echo "DOMAIN_NAME deve conter apenas o domínio, sem protocolo, porta ou caminho." >&2
        exit 1
        ;;
esac

for certificate in fullchain.pem privkey.pem; do
    if [ ! -r "/etc/letsencrypt/live/${DOMAIN_NAME}/${certificate}" ]; then
        echo "O certificado HTTPS do domínio configurado está ausente ou não pode ser lido." >&2
        exit 1
    fi
done
