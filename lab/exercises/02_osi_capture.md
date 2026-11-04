# Exercice 2 — Le modèle OSI dans une vraie capture

**Niveau :** ⭐⭐ · **Durée :** ~1 h
**📖 Fiche théorique à lire avant :** `https://<votre-site>.pythonanywhere.com/osi`

## 🎯 Objectifs

- **Capturer** (enregistrer) les paquets d'une vraie visite de page web.
- Retrouver dans ces paquets les **couches du modèle OSI** et leurs en-têtes.
- Observer la « poignée de main » TCP qui précède chaque échange HTTP.

> 🖥️ Préparation : lab démarré (`docker compose up -d` dans le dossier `lab`).
> Ouvrez **deux terminaux client** 💻 (voir exercice 0, étape 4) et gardez un terminal Codespace 🖥️.

---

## Partie A — Capturer une visite web

### Étape 1 — Préparer la capture

💻 **Terminal client n°1** — supprimez une éventuelle ancienne capture :

```bash
rm -f /tmp/http.pcap
```

### Étape 2 — Lancer l'enregistrement

💻 **Terminal client n°1** — lancez `tcpdump`, le « magnétophone » du réseau :

```bash
tcpdump -i eth0 -U -nn -c 20 -w /tmp/http.pcap host 172.20.0.10
```

Ce que veut dire chaque morceau :

| Morceau | Signification |
| ------- | ------------- |
| `-i eth0` | écouter sur l'interface `eth0` |
| `-c 20` | s'arrêter tout seul après 20 paquets |
| `-w /tmp/http.pcap` | enregistrer dans ce fichier (au lieu d'afficher) |
| `host 172.20.0.10` | ne garder que les paquets échangés avec le site web |
| `-U -nn` | écrire immédiatement, ne pas traduire les adresses en noms |

👀 `tcpdump` affiche `listening on eth0…` puis **attend**. C'est normal : il enregistre.

### Étape 3 — Visiter le site web

💻 **Terminal client n°2** — pendant que tcpdump tourne, demandez deux pages :

```bash
curl http://172.20.0.10/
curl http://172.20.0.10/whoami
```

👀 Dans le terminal n°1, tcpdump s'arrête et affiche `20 packets captured`.
S'il attend encore, relancez une fois `curl http://172.20.0.10/`.

### Étape 4 — Lister les paquets capturés

🖥️ **Terminal Codespace** (à la racine du dépôt — tapez `cd ..` si vous êtes dans `lab`) :

```bash
./lab/exercises/osi_inspect.py
```

👀 Une ligne par paquet. Exemple :

```
 1  172.20.1.50 → 172.20.0.10  TCP 74 52790 → 80 [SYN] ...
 2  172.20.0.10 → 172.20.1.50  TCP 74 80 → 52790 [SYN, ACK] ...
 3  172.20.1.50 → 172.20.0.10  TCP 66 52790 → 80 [ACK] ...
 4  172.20.1.50 → 172.20.0.10  HTTP 141 GET / HTTP/1.1
 ...
 8  172.20.0.10 → 172.20.1.50  HTTP 948 HTTP/1.1 200 OK  (text/html)
```

**Question A.1.** Les 3 premiers paquets ne contiennent pas encore de HTTP. Ils portent les
indicateurs `[SYN]`, `[SYN, ACK]`, `[ACK]`. Comment s'appelle cet échange, et à quoi sert-il ?

> 💬 **Votre réponse :**
>
> Cet échange s'appelle la **triple poignée de main TCP** (*TCP 3-way handshake*).
> Il sert à **établir une connexion fiable** (couche 4 — Transport) entre le client et le serveur avant tout transfert de données applicatives (HTTP). Il permet de synchroniser les numéros de séquence initiaux (ISN) et de négocier les paramètres de la connexion (taille des fenêtres, MSS, etc.).

**Question A.2.** Repérez le numéro du paquet contenant la **requête** `GET /` et celui contenant
la **réponse** `200 OK`. Qui envoie chacun d'eux (IP source) ?

> 💬 **Votre réponse :**
>
> - **Requête `GET /` :** Paquet n°**4**. L'IP source est `172.20.1.50` (le **client**).
> - **Réponse `200 OK` :** Paquet n°**8**. L'IP source est `172.20.0.10` (le **serveur web / site internet**).

---

## Partie B — Éplucher un paquet couche par couche

### Étape 5 — Détailler la requête HTTP

🖥️ Affichez le détail du paquet de la requête (remplacez `4` par le numéro trouvé en A.2) :

```bash
./lab/exercises/osi_inspect.py 4
```

👀 Le script affiche un tableau **par couche OSI** (L2, L3, L4, L7), avec pour chaque champ sa
**valeur** dans votre capture et une **explication**.

**Question B.1.** Complétez le tableau avec les valeurs de **votre** capture :

| Couche OSI         | Protocole | Champ observé       | Valeur dans ma capture |
| ------------------ | --------- | ------------------- | ---------------------- |
| 7 — Application    | HTTP      | Méthode et chemin   | `GET / HTTP/1.1`       |
| 4 — Transport      | TCP       | Port source         | `52790` (port éphémère)|
| 4 — Transport      | TCP       | Port destination    | `80`                   |
| 3 — Réseau         | IPv4      | IP source           | `172.20.1.50`          |
| 3 — Réseau         | IPv4      | IP destination      | `172.20.0.10`          |
| 3 — Réseau         | IPv4      | TTL                 | `64`                   |
| 2 — Liaison        | Ethernet  | MAC source          | `02:42:ac:14:01:32` (MAC du client) |
| 2 — Liaison        | Ethernet  | MAC destination     | `02:42:ac:14:01:fe` (MAC de la passerelle `172.20.1.254`) |
| 1 — Physique       | —         | (non visible)       | —                      |

**Question B.2.** Le port destination est `80`. Que désigne-t-il ? Le port source est un grand
nombre (ex. `52790`) : qui l'a choisi, et pourquoi n'est-il pas toujours le même ?

> 💬 **Votre réponse :**
>
> - **Port destination `80` :** C'est le port d'écoute standard et réservé du service HTTP sur le serveur.
> - **Port source (ex. `52790`) :** C'est un port éphémère (*ephemeral port*) alloué automatiquement et dynamiquement par le système d'exploitation du client (la pile réseau du noyau). Il change à chaque nouvelle connexion pour garantir que chaque socket (`IP_src:Port_src` vers `IP_dst:Port_dst`) reste unique, ce qui permet de multiplexer plusieurs connexions simultanées sans collision.

**Question B.3.** La **MAC destination** est-elle celle du site web `internet` ? À quelle machine
appartient-elle ? (Comparez avec `ip neigh` dans le terminal client, et repensez à l'exercice 1.)

> 💬 **Votre réponse :**
>
> **Non**, ce n'est pas la MAC du site web. Elle appartient à la **passerelle par défaut : `nat-router`** (`172.20.1.254`).
> Les trames Ethernet de couche 2 ne franchissent pas les routeurs ; le client remet donc la trame sur le réseau local à son routeur en indiquant la MAC de celui-ci, tandis que l'IP de destination de couche 3 reste celle de la cible finale (`172.20.0.10`).

### Étape 6 — Comparer avec un paquet sans HTTP

🖥️ Affichez le premier paquet (le `SYN`) :

```bash
./lab/exercises/osi_inspect.py 1
```

**Question B.4.** Recopiez la ligne `Pile présente : …` des paquets 1 et 4. Quelle couche manque
dans le paquet 1 ? Pourquoi ?

> 💬 **Votre réponse :**
>
> - **Paquet 1 :** `Pile présente : L2 (Ethernet) → L3 (IPv4) → L4 (TCP)`
> - **Paquet 4 :** `Pile présente : L2 (Ethernet) → L3 (IPv4) → L4 (TCP) → L7 (HTTP)`
> - **Couche manquante :** La couche **7 (Application — HTTP)** est absente du paquet 1.
> - **Pourquoi :** Le paquet 1 sert uniquement à initialiser la connexion TCP au niveau de la couche Transport (SYN). Tant que la connexion TCP n'est pas établie (au terme de la poignée de main en 3 étapes), aucune donnée applicative HTTP n'est transmise.

### Étape 7 — Regarder la réponse du serveur

🖥️ Affichez le paquet contenant `200 OK` (remplacez `8` par votre numéro) :

```bash
./lab/exercises/osi_inspect.py 8
```

**Question B.5.** Quel est le `Content-Type` de la réponse ? Que contient la ligne
`Payload HTTP (extrait)` ? Dans quelle couche OSI ranger le `Content-Type` (le **format** des
données) ? Aidez-vous de la fiche théorique.

> 💬 **Votre réponse :**
>
> - **Content-Type :** `text/html`
> - **Payload HTTP (extrait) :** Le code HTML de la page d'accueil (ex. `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Pseudo-Internet (lab)</title>...`).
> - **Couche OSI :** Le `Content-Type` relève de la **couche 6 (Présentation)**, car il décrit le format, la structure et l'encodage des données transmises pour permettre à l'application de les interpréter correctement.

---

## Partie C — Encapsulation

**Question C.1.** En vous aidant du *Vocabulaire* de la fiche OSI, expliquez avec vos mots ce
qu'est l'**encapsulation**, en prenant l'exemple de la requête `GET /` que vous avez capturée.
Complétez le schéma :

```
[ Ethernet | IP | TCP | HTTP ]
   L2       L3    L4    L7
```

> 💬 **Votre réponse :**
>
> L'**encapsulation** est le mécanisme par lequel chaque couche réseau descendante enveloppe les données de la couche supérieure (la SDU) en y ajoutant son propre en-tête de contrôle (*header*), formant ainsi une PDU complète, à la manière de poupées russes.
> Dans notre exemple :
> 1. Le message HTTP `GET /` (L7) forme les données de départ.
> 2. TCP (L4) ajoute son en-tête (ports source/destination 52790 → 80, numéros de séquence) pour former un **segment TCP**.
> 3. IP (L3) ajoute son en-tête (adresses IP 172.20.1.50 → 172.20.0.10, TTL) pour former un **paquet IP**.
> 4. Ethernet (L2) ajoute les adresses MAC source et passerelle pour former une **trame Ethernet** prête à être transmise sur le média physique sous forme de bits (L1).

**Question C.2.** Associez chaque nom de PDU à sa couche : **trame**, **paquet**, **segment**, **bit**.

> 💬 **Votre réponse :**
>
> - **Bit :** Couche 1 — Physique
> - **Trame :** Couche 2 — Liaison de données
> - **Paquet :** Couche 3 — Réseau
> - **Segment :** Couche 4 — Transport (TCP) *(ou datagramme en UDP)*

---

## 🚀 Pour aller plus loin (facultatif)

**Question P.1.** Où l'adresse IP du client est-elle remplacée ? Capturez **côté WAN du routeur** :

🔀 Terminal routeur (`docker exec -it lab_nat_router bash`) :

```bash
tcpdump -i wan -nn -c 6 host 172.20.0.10
```

💻 Terminal client : `curl http://172.20.0.10/whoami`

Quelle IP source voyez-vous côté WAN ? Comparez avec votre capture côté client.

> 💬 **Votre réponse :**
>
> - **IP source côté WAN :** `172.20.0.254` (l'adresse de l'interface WAN du routeur).
> - **Comparaison :** Côté client, l'IP source était `172.20.1.50`. C'est le routeur `nat-router` qui a remplacé l'adresse IP source privée du client par sa propre adresse publique WAN lors de la traversée : c'est le mécanisme de **NAT (Source NAT / Masquerade)**.

**Question P.2.** Sur votre propre ordinateur, ouvrez un site en `https://`. En quoi la capture
serait-elle différente ? Quelles informations ne pourrait-on plus lire ?

> 💬 **Votre réponse :**
>
> - **Différence :** Le protocole de chiffrement **TLS** s'intercale entre TCP (L4) et HTTP (L7), et le port destination devient `443`.
> - **Ce qu'on ne pourrait plus lire :** Le contenu de la couche 7 est entièrement chiffré. On ne peut plus voir la méthode (`GET`), l'URL/chemin demandé, les en-têtes HTTP (cookies, user-agent) ni le corps de la requête ou de la réponse (payload).
> - **Ce qui reste visible :** Les adresses MAC (L2), les adresses IP (L3), les ports TCP (L4) et le nom de domaine du site hôte (indiqué en clair dans l'extension TLS *SNI - Server Name Indication* lors de l'établissement TLS).

---

## ✅ Ce qu'il faut retenir

- `tcpdump` enregistre les paquets ; `osi_inspect.py` les décompose couche par couche.
- Avant tout échange HTTP, TCP ouvre la connexion avec 3 paquets : **SYN, SYN-ACK, ACK**.
- Chaque couche ajoute son **en-tête** : MAC (L2), IP (L3), ports (L4), requête HTTP (L7).
- La MAC de destination est celle du **prochain saut**, l'IP de destination est celle de la **cible finale**.

## 🆘 En cas de problème

| Problème | Solution |
| -------- | -------- |
| `tcpdump: /tmp/http.pcap: Permission denied` | 💻 `rm -f /tmp/http.pcap` puis relancez tcpdump |
| tcpdump n'atteint jamais 20 paquets | Relancez `curl` dans le terminal n°2, ou faites <kbd>Ctrl</kbd>+<kbd>C</kbd> |
| `osi_inspect.py` : `No such file or directory` | Vous n'êtes pas à la racine du dépôt. 🖥️ `cd /workspaces/*/` |
| `osi_inspect.py` : `Erreur tshark` | La capture est vide ou absente : recommencez l'étape 1 |
