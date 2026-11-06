# Exercice 3 — DHCP : obtenir une adresse IP automatiquement

**Niveau :** ⭐⭐ · **Durée :** ~1 h
**📖 Fiche théorique à lire avant :** `https://<votre-site>.pythonanywhere.com/dhcp`

## 🎯 Objectifs

- Constater qu'une machine **sans adresse IP** ne peut pas communiquer.
- Capturer les **4 messages DHCP** (Discover, Offer, Request, ACK = « DORA »).
- Retrouver dans ces messages la configuration reçue : IP, masque, passerelle, DNS, durée du bail.

> 🖥️ Préparation : lab démarré. Ouvrez **deux terminaux client** 💻 et gardez un terminal Codespace 🖥️
> (à la racine du dépôt).

---

## Partie A — Un client sans adresse

### Étape 1 — État de départ

💻 **Terminal client n°1** — notez l'adresse actuelle du client :

```bash
ip -br addr show eth0
```

👀 Vous voyez `172.20.1.50/24`. Cette adresse a été fixée **à la main** (par la configuration
du lab) : c'est une adresse **statique**.

### Étape 2 — Supprimer l'adresse

💻 **Terminal client n°1** — retirez l'adresse IP et faites oublier au client tout bail DHCP précédent :

```bash
ip addr flush dev eth0
rm -f /var/lib/dhcp/dhclient.leases
ip -br addr show eth0
```

💻 Essayez de joindre le routeur :

```bash
ping -c 2 172.20.1.254
```

**Question A.1.** Quel message obtenez-vous ? Pourquoi le client ne peut-il plus rien envoyer ?

> 💬 **Votre réponse :**
>
> On obtient l'erreur : `ping: connect: Network is unreachable`.
> En vidant la configuration de l'interface avec `ip addr flush`, l'adresse IP et toutes les routes associées (la route locale et la passerelle par défaut) ont été supprimées de la table de routage. Le noyau ne sait plus par où router le paquet ni quelle IP source utiliser, donc l'émission est bloquée.

---

## Partie B — Capturer l'échange DORA

### Étape 3 — Lancer la capture

💻 **Terminal client n°1** — enregistrez les paquets DHCP (ports UDP 67 et 68) :

```bash
rm -f /tmp/dhcp.pcap
tcpdump -i eth0 -U -nn -c 4 -w /tmp/dhcp.pcap port 67 or port 68
```

👀 `listening on eth0…` puis attente.

### Étape 4 — Demander une adresse

💻 **Terminal client n°2** — lancez le client DHCP en mode bavard (`-v`) :

```bash
dhclient -v eth0
```

👀 Vous devez voir les 4 étapes, dans cet ordre :

```
DHCPDISCOVER on eth0 to 255.255.255.255 port 67 ...
DHCPOFFER of 172.20.1.1xx from 172.20.1.2
DHCPREQUEST for 172.20.1.1xx on eth0 to 255.255.255.255 port 67
DHCPACK of 172.20.1.1xx from 172.20.1.2
bound to 172.20.1.1xx -- renewal in ... seconds.
```

Et dans le terminal n°1, tcpdump s'arrête : `4 packets captured`.

**Question B.1.** Recopiez les 5 lignes affichées par `dhclient`. Quelle adresse IP avez-vous obtenue ?
Qui vous l'a donnée ?

> 💬 **Votre réponse :**
>
> Les 5 lignes obtenues :
> ```text
> DHCPDISCOVER on eth0 to 255.255.255.255 port 67 interval 3
> DHCPOFFER of 172.20.1.134 from 172.20.1.2
> DHCPREQUEST for 172.20.1.134 on eth0 to 255.255.255.255 port 67
> DHCPACK of 172.20.1.134 from 172.20.1.2
> bound to 172.20.1.134 -- renewal in 20562 seconds.
> ```
> J'ai obtenu l'adresse `172.20.1.134`. Elle a été attribuée par le serveur DHCP du lab (`172.20.1.2`, conteneur `lab_dhcp_server`).

### Étape 5 — Analyser les 4 messages

🖥️ **Terminal Codespace** — listez les paquets capturés :

```bash
./lab/exercises/osi_inspect.py --pcap /tmp/dhcp.pcap
```

🖥️ Puis détaillez chacun d'eux (paquets 1 à 4) :

```bash
./lab/exercises/osi_inspect.py 1 --pcap /tmp/dhcp.pcap
./lab/exercises/osi_inspect.py 2 --pcap /tmp/dhcp.pcap
./lab/exercises/osi_inspect.py 3 --pcap /tmp/dhcp.pcap
./lab/exercises/osi_inspect.py 4 --pcap /tmp/dhcp.pcap
```

**Question B.2.** Complétez le tableau DORA avec **votre** capture :

| Étape       | IP source | IP destination    | MAC destination   | Type DHCP (opt 53) | Transaction ID |
| ----------- | --------- | ----------------- | ----------------- | ------------------ | -------------- |
| 1. Discover | `0.0.0.0` | `255.255.255.255` | `ff:ff:ff:ff:ff:ff` | 1 (Discover)     | `0x3a1b8c2e`   |
| 2. Offer    | `172.20.1.2` | `172.20.1.134` | `02:42:ac:14:01:32` | 2 (Offer)        | `0x3a1b8c2e`   |
| 3. Request  | `0.0.0.0` | `255.255.255.255` | `ff:ff:ff:ff:ff:ff` | 3 (Request)      | `0x3a1b8c2e`   |
| 4. ACK      | `172.20.1.2` | `172.20.1.134` | `02:42:ac:14:01:32` | 5 (ACK)          | `0x3a1b8c2e`   |

**Question B.3.** Dans le paquet **Offer** (n°2), relevez la configuration proposée par le serveur :

| Information              | Option DHCP | Valeur |
| ------------------------ | ----------- | ------ |
| Adresse IP proposée      | (yiaddr)    | `172.20.1.134` |
| Masque de sous-réseau    | 1           | `255.255.255.0` |
| Passerelle (routeur)     | 3           | `172.20.1.254` |
| Serveurs DNS             | 6           | `1.1.1.1, 8.8.8.8` |
| Durée du bail (secondes) | 51          | `43200` |

Convertissez la durée du bail en heures.

> 💬 **Votre réponse (conversion) :**
>
> 43200 secondes / 3600 = **12 heures** (ce qui correspond bien à la directive `12h` dans `dnsmasq.conf`).

---

## Partie C — Vérifier la configuration reçue

### Étape 6 — Le client est configuré

💻 **Terminal client n°2** :

```bash
ip -br addr show eth0
ip route
cat /etc/resolv.conf
ping -c 2 172.20.1.254
```

**Question C.1.** Retrouvez-vous dans `ip addr`, `ip route` et `resolv.conf` les valeurs de la
question B.3 ? Le ping vers le routeur fonctionne-t-il à nouveau ?

> 💬 **Votre réponse :**
>
> Oui, tout concorde :
> - `ip addr` affiche bien `172.20.1.134/24` sur `eth0`.
> - `ip route` montre la route par défaut `default via 172.20.1.254 dev eth0`.
> - `/etc/resolv.conf` contient `nameserver 1.1.1.1` et `nameserver 8.8.8.8`.
> Le ping vers la passerelle `172.20.1.254` fonctionne de nouveau sans perte.

### Étape 7 — Le point de vue du serveur

🖥️ **Terminal Codespace** — lisez le journal du serveur DHCP, en ne gardant que les lignes des 4 étapes :

```bash
docker logs lab_dhcp_server 2>&1 | grep -E "DHCP(DISCOVER|OFFER|REQUEST|ACK)"
```

👀 Chaque ligne contient le *transaction ID* (en décimal), l'étape (`DHCPDISCOVER`, `DHCPOFFER`…),
l'adresse IP et l'adresse MAC concernées.

> 💡 Pour voir **tout** le journal (options envoyées, etc.) : `docker logs --tail 40 lab_dhcp_server`.

**Question C.2.** Retrouvez les 4 étapes DORA dans le journal. Quelle **adresse MAC** le serveur
a-t-il associée à l'IP attribuée ?

> 💬 **Votre réponse :**
>
> On retrouve bien les 4 étapes avec le même Transaction ID dans les logs. Le serveur a lié l'IP `172.20.1.134` à l'adresse MAC du client, c'est-à-dire `02:42:ac:14:01:32`.

---

## Partie D — Comprendre

**Question D.1.** Pourquoi le client utilise-t-il `0.0.0.0` comme **IP source** dans le Discover ?

> 💬 **Votre réponse :**
>
> Parce qu'au moment d'envoyer le Discover, le client n'a pas encore d'adresse IP valide. L'adresse `0.0.0.0` est réservée par la RFC DHCP pour désigner un hôte non encore configuré sur le réseau local.

**Question D.2.** Pourquoi le Discover est-il envoyé à `255.255.255.255` et à la MAC `ff:ff:ff:ff:ff:ff` ?
Que signifient ces adresses ?

> 💬 **Votre réponse :**
>
> Ce sont les adresses de broadcast (diffusion) au niveau IP (couche 3) et Ethernet (couche 2). Le client ne sait pas encore où se trouve le serveur DHCP ni quelle est son IP/MAC. En diffusant en broadcast, toutes les machines du LAN reçoivent le message, et seul le serveur DHCP le prend en charge.

**Question D.3.** À quoi sert le **Transaction ID**, identique dans les 4 messages ?
(Imaginez 30 PC qui démarrent en même temps sur le même réseau.)

> 💬 **Votre réponse :**
>
> C'est un identifiant de session généré aléatoirement par le client. Si plusieurs machines démarrent en même temps et lancent des requêtes DHCP en broadcast, le Transaction ID permet à chaque client d'identifier les offres (Offer) et validations (ACK) qui lui sont destinées et d'ignorer celles des autres machines.

**Question D.4.** Que se passe-t-il quand le **bail expire** ? Pourquoi les baux ont-ils une durée
limitée plutôt qu'infinie ?

> 💬 **Votre réponse :**
>
> Si le bail expire sans avoir été renouvelé, le client doit obligatoirement cesser d'utiliser l'adresse IP et redémarrer la procédure depuis le Discover.
> Les baux ont une durée limitée pour permettre au serveur de récupérer et réassigner les adresses des machines éteintes ou déconnectées, ce qui évite d'épuiser les adresses disponibles dans le pool.

---

## 🚀 Pour aller plus loin (facultatif)

**P.1 — Rendre son adresse.** 💻 Libérez le bail puis redemandez-en un :

```bash
dhclient -r -v eth0
ip -br addr show eth0
dhclient -v eth0
```

Quel message est envoyé par `dhclient -r` ? Obtenez-vous la même adresse ensuite ? Pourquoi, d'après vous ?

> 💬 **Votre réponse :**
>
> La commande `dhclient -r` émet un message `DHCPRELEASE` en unicast vers le serveur DHCP.
> En redemandant une adresse juste après, on réobtient la même (`172.20.1.134`). Dnsmasq conserve une table d'association récente (ou dérive l'attribution de la MAC), donc tant que l'adresse est libre, il la redonne au même client.

**P.2 — Panne du serveur DHCP.** 🖥️ Arrêtez le serveur, puis 💻 redemandez une adresse :

```bash
# 🖥️ Terminal Codespace (dans le dossier lab)
docker compose stop dhcp-server
```

```bash
# 💻 Terminal client
dhclient -r eth0
rm -f /var/lib/dhcp/dhclient.leases
timeout 30 dhclient -v -1 eth0
```

Que se passe-t-il ? Quelles conséquences dans une entreprise si le serveur DHCP tombe en panne ?
**Pensez à le redémarrer** : 🖥️ `docker compose start dhcp-server`.

> 💬 **Votre réponse :**
>
> `dhclient` envoie des DISCOVER en boucle sans réponse et finit par abandonner avec `No working leases in persistent database - sleeping`.
> En entreprise, les machines qui ont déjà un bail actif continuent de communiquer jusqu'à son expiration, mais aucun nouvel appareil ne pourra obtenir d'adresse IP ni accéder au réseau, ce qui paralyse les utilisateurs arrivant sur le réseau.

---

## ✅ Ce qu'il faut retenir

- Sans adresse IP, une machine ne peut pas communiquer : DHCP la configure **automatiquement**.
- L'échange se fait en 4 messages : **D**iscover, **O**ffer, **R**equest, **A**CK.
- Le client commence en **broadcast** (il ne connaît encore personne) depuis `0.0.0.0`.
- Le serveur fournit IP, masque, passerelle, DNS, et une **durée de bail**.

## 🆘 En cas de problème

| Problème | Solution |
| -------- | -------- |
| Seulement 2 paquets (REQUEST/ACK), pas de Discover | Le client se souvenait d'un ancien bail. 💻 `dhclient -r eth0; rm -f /var/lib/dhcp/dhclient.leases` puis recommencez l'étape 3 |
| `hostname: you must be root to change the host name` | Message sans importance, ignorez-le |
| `dhclient` attend sans fin | Le serveur DHCP est-il démarré ? 🖥️ `docker compose ps` |
| Remettre le client dans son état initial (`172.20.1.50`) | 🖥️ `docker compose restart client` |
