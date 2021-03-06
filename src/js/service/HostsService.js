import hostile from 'hostile';

import {HOSTS} from '../secure/OS';

const ALIAS_PREFIX = 'hosts_alias_';

const getDisableList = () => {
    const str = localStorage.getItem(ALIAS_PREFIX + 'disabledList');
    return str ? JSON.parse(str) : [];
};

export function get() {
    const disabledList = getDisableList();
    return new Promise(function(resolve, reject) {
        hostile.get(false, function(error, lines) {
            if (error) {
                return reject(error.message);
            }
            const rowData = lines.map(line => {
                const ip = line[0];
                const domain = line[1];
                return {
                    alias: localStorage.getItem(ALIAS_PREFIX + ip),
                    ip: ip,
                    domain: domain,
                    disabled: false
                };
            });
            const hosts = rowData.concat(disabledList);
            hosts.sort(function(a, b) {
                const aa = a.ip.split('.');
                const bb = b.ip.split('.');
                return (aa[0] * 0x1000000 + aa[1] * 0x10000 + aa[2] * 0x100 + aa[3] * 1)
                    - (bb[0] * 0x1000000 + bb[1] * 0x10000 + bb[2] * 0x100 + bb[3] * 1);
            });
            resolve(hosts);
        });
    });
}

export function add(host) {
    return get()
        .then(data => {
            const filtered = data.find(item => !item.disabled && item.domain === host.domain);
            if (filtered) {
                return toggleDisable(filtered);
            }
        })
        .then(() => {
            return new Promise((resolve, reject) => {
                hostile.set(host.ip, host.domain, err => {
                    if (err) {
                        return reject('failed adding ' + host.ip +
                            '\n\n Please Make sure you have permission to modify ' + HOSTS + ' file');
                    }
                    if (host.alias) {
                        localStorage.setItem(ALIAS_PREFIX + host.ip, host.alias);
                    }
                    host.disabled = false;
                    resolve(host);
                });
            });
        });
}

export function remove(host) {
    if (host.disabled) {
        return new Promise(resolve => {
            const list = getDisableList();
            const filteredList = list.filter(item => item.ip !== host.ip || item.domain !== host.domain);
            localStorage.setItem(ALIAS_PREFIX + 'disabledList', JSON.stringify(filteredList));
            resolve(host);
        });
    }
    return new Promise((resolve, reject) => {
        hostile.remove(host.ip, host.domain, err => {
            if (err) {
                return reject('failed deleting ' + host.ip +
                    '\n\n Please Make sure you have permission to modify ' + HOSTS + ' file');
            }
            localStorage.removeItem(ALIAS_PREFIX + host.ip);
            resolve(host);
        });
    });
}

export function toggleDisable(host) {
    if (host.disabled) {
        return add(host)
            .then(() => {
                host.disabled = false;
                const list = getDisableList();
                const filteredList = list.filter(item => item.ip !== host.ip || item.domain !== host.domain);
                localStorage.setItem(ALIAS_PREFIX + 'disabledList', JSON.stringify(filteredList));
                return host;
            });
    }
    return remove(host)
        .then(() => {
            host.disabled = true;
            const list = getDisableList();
            list.push(host);
            localStorage.setItem(ALIAS_PREFIX + 'disabledList', JSON.stringify(list));
            return host;
        });
}

export function setAlias(alias, row) {
    return new Promise(resolve => {
        if (alias) {
            localStorage.setItem(ALIAS_PREFIX + row.ip, alias);
            return resolve();
        }
        localStorage.removeItem(ALIAS_PREFIX + row.ip);
        return resolve();
    });
}

export function addPermission() {
    localStorage.setItem(ALIAS_PREFIX + 'permission', 'true');
}

export function isPermissionSet() {
    return !!localStorage.getItem(ALIAS_PREFIX + 'permission');
}
