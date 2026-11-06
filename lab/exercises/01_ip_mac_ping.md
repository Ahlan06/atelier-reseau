# Exercice 1 — Adresses IP, adresses MAC et ping

**Niveau :** ⭐ · **Durée :** ~45 min
**📖 Fiche théorique à lire avant :** `https://<votre-site>.pythonanywhere.com/bases`

## 🎯 Objectifs

- Lire l'adresse IP, le masque et l'adresse MAC d'une machine.
- Comprendre le rôle de la **passerelle** (le routeur).
- Voir **ARP** remplir la table des voisins.
- Tester la connectivité avec `ping` et `traceroute`.

> 📍 Tout cet exercice se fait dans le **terminal du client** 💻.
> 🖥️ Si besoin : `cd /workspaces/*/lab && docker compose up -d && docker exec -it lab_client bash`

---

## Partie A — Qui suis-je ?

### Étape 1 — Mes adresses

💻 Affichez vos interfaces réseau :

```bash
ip addr
```

👀 Repérez l'interface **`eth0`**. Sur la ligne `link/ether` se trouve l'**adresse MAC** ;
sur la ligne `inet` se trouvent l'**adresse IP** et le **masque** (après le `/`).

> 💡 L'interface `lo` (*loopback*, `127.0.0.1`) est une interface virtuelle qui permet à la
> machine de se parler à elle-même. On l'ignore dans cet exercice.

**Question A.1.** Complétez le tableau pour le client :

| Information        | Valeur pour le client |
| ------------------ | --------------------- |
| Nom de l'interface | `eth0` |
| Adresse MAC        | `02:42:ac:14:01:32` |
| Adresse IP         | `172.20.1.50` |
| Masque (notation `/`) | `/24` |
| Adresse du réseau  | `172.20.1.0/24` |

**Question A.2.** Le masque est `/24`. Combien de machines différentes peut-on placer dans ce réseau ?
(Indice : le dernier nombre de l'adresse peut varier de 0 à 255, mais 2 valeurs sont réservées.)

> 💬 **Votre réponse :**
>
> On peut placer 254 machines. En `/24`, il reste 8 bits pour les hôtes, donc $2^8 = 256$ adresses en tout. On enlève l'adresse réseau (`172.20.1.0`) et le broadcast (`172.20.1.255`), ce qui donne 254 adresses IP attribuables (de `172.20.1.1` à `172.20.1.254`).

### Étape 2 — Ma passerelle

💻 Affichez la table de routage :

```bash
ip route
```

👀 Deux lignes apparaissent :

- `172.20.1.0/24 dev eth0 …` → « pour joindre mon réseau local, j'envoie directement sur `eth0` » ;
- `default via 172.20.1.254 …` → « pour **tout le reste**, je passe par `172.20.1.254` ».

**Question A.3.** Quelle est l'adresse de la passerelle du client ? À quelle machine du lab correspond-elle ?

> 💬 **Votre réponse :**
>
> La passerelle est `172.20.1.254`. Elle correspond à l'interface LAN du routeur `nat-router`.

---

## Partie B — Mes voisins (ARP)

### Étape 3 — Table ARP vide

💻 Videz puis affichez la table ARP (la liste des voisins dont le client connaît la MAC) :

```bash
ip neigh flush all
ip neigh
```

👀 La table est vide (ou ne contient que des lignes `FAILED`).

### Étape 4 — Un ping fait apparaître un voisin

💻 Envoyez 3 pings au serveur DHCP, qui est sur le **même réseau** que vous :

```bash
ping -c 3 172.20.1.2
```

👀 Vous devez voir 3 lignes `64 bytes from 172.20.1.2: icmp_seq=… ttl=64 time=… ms`
puis `0% packet loss`.

💻 Affichez à nouveau la table ARP :

```bash
ip neigh
```

**Question B.1.** Quelle nouvelle ligne est apparue ? Que contient-elle ? Pourquoi le client a-t-il
eu besoin de cette information **avant** de pouvoir envoyer le ping ?

> 💬 **Votre réponse :**
>
> La ligne `172.20.1.2 dev eth0 lladdr 02:42:ac:14:01:02 REACHABLE` est apparue dans la table. Elle fait correspondre l'IP du serveur DHCP (`172.20.1.2`) à son adresse MAC physique sur `eth0`.
> Le client en avait besoin car pour envoyer le paquet ICMP sur le câble (en couche 2 Ethernet), il faut obligatoirement construire une trame avec l'adresse MAC du destinataire. Le client a donc envoyé une requête ARP (*Who has 172.20.1.2?*) pour l'apprendre avant de transmettre le ping.

### Étape 5 — Joindre une machine d'un autre réseau

💻 Videz la table ARP, puis faites un ping vers le site web `internet`, qui est sur un **autre réseau** :

```bash
ip neigh flush all
ping -c 3 172.20.0.10
ip neigh
```

**Question B.2.** Cette fois, le client n'a **pas** appris la MAC de `172.20.0.10`. De quelle IP
a-t-il appris la MAC ? Expliquez pourquoi, en vous aidant de la fiche théorique.

> 💬 **Votre réponse :**
>
> Il a appris la MAC de la passerelle `172.20.1.254` (`nat-router`).
> L'IP cible `172.20.0.10` est sur un autre sous-réseau (WAN). Les requêtes ARP ne traversent pas les routeurs (elles restent sur le domaine de broadcast local). Le client applique donc sa table de routage (`default via 172.20.1.254`) : il résout la MAC de son routeur et lui transmet la trame, en lui laissant le soin de router le paquet.

---

## Partie C — Le chemin vers Internet

### Étape 6 — Comparer les TTL

💻 Faites un ping vers le routeur, puis vers le site web, et regardez la valeur `ttl=` :

```bash
ping -c 2 172.20.1.254
ping -c 2 172.20.0.10
```

**Question C.1.** Notez le TTL des réponses dans les deux cas. Sont-ils identiques ? Que signifie
cette différence ? (Indice : chaque routeur traversé diminue le TTL de 1.)

> 💬 **Votre réponse :**
>
> On a `ttl=64` pour le routeur et `ttl=63` pour le site web. Ils ne sont pas identiques car le paquet provenant du site web a dû traverser le routeur `nat-router`. Chaque passage par un routeur décrémente le TTL de 1 (donc $64 - 1 = 63$). Le routeur, lui, répond directement sur le LAN sans intermédiaire, d'où le 64.

### Étape 7 — traceroute

💻 Affichez la liste des routeurs traversés pour atteindre le site web :

```bash
traceroute -n 172.20.0.10
```

👀 Chaque ligne numérotée est un **saut** (*hop*).

**Question C.2.** Combien de sauts y a-t-il ? Quelle est l'adresse du premier saut ?
Dessinez (en texte) le chemin suivi : `client → … → internet`.

> 💬 **Votre réponse :**
>
> Il y a 2 sauts. L'adresse du premier saut est `172.20.1.254` (la passerelle `nat-router`).
> Chemin : `client (172.20.1.50) → nat-router (172.20.1.254) → internet (172.20.0.10)`

### Étape 8 — Le lab est isolé

💻 Essayez de joindre un vrai serveur d'Internet (le DNS de Google) :

```bash
ping -c 2 -W 2 8.8.8.8
```

**Question C.3.** Que se passe-t-il ? Pourquoi, selon vous ? (Pensez à ce qu'il y a derrière le routeur du lab.)

> 💬 **Votre réponse :**
>
> Le ping échoue avec 100% de paquets perdus. C'est normal : le lab Docker est configuré en réseau privé isolé (sans masquerade vers l'hôte). Le routeur du lab n'est relié qu'au LAN et au conteneur `internet`, il n'a aucune passerelle vers le véritable Internet externe pour router vers `8.8.8.8`.

---

## Partie D — Synthèse

**Question D.1.** Complétez avec vos propres mots :

| Notion        | Explication en une phrase |
| ------------- | ------------------------- |
| Adresse IP    | Identifiant logique de couche 3 permettant d'acheminer les paquets d'un réseau à un autre. |
| Adresse MAC   | Adresse physique de couche 2 propre à la carte réseau, utilisée pour communiquer sur le réseau local. |
| Passerelle    | Routeur du réseau local à qui une machine envoie les paquets destinés à l'extérieur. |
| ARP           | Protocole qui permet de trouver l'adresse MAC correspondant à une adresse IP sur le même lien local. |
| TTL           | Compteur décrémenté par chaque routeur pour éviter qu'un paquet ne tourne en boucle indéfiniment. |

**Question D.2.** Vrai ou faux ? Justifiez : « Pour envoyer un paquet à `172.20.0.10`, le client met
dans la trame la MAC de `172.20.0.10`. »

> 💬 **Votre réponse :**
>
> Faux. La machine `172.20.0.10` n'est pas sur le même réseau local, donc le client ne connaît pas sa MAC et ne peut pas la joindre directement en couche 2. Il met dans la trame l'adresse MAC de sa passerelle (`172.20.1.254`) tout en gardant l'IP destination finale `172.20.0.10` dans le paquet. C'est ensuite le routeur qui réencapsulera le paquet pour l'envoyer au serveur web.

---

## ✅ Ce qu'il faut retenir

- `ip addr` → mes adresses ; `ip route` → ma passerelle ; `ip neigh` → mes voisins (ARP).
- Sur le **même réseau**, on parle directement à la machine (on demande sa MAC avec ARP).
- Vers un **autre réseau**, on confie le paquet à la **passerelle** : la MAC utilisée est celle du routeur.
- Le **TTL** diminue de 1 à chaque routeur traversé.

## 🆘 En cas de problème

| Problème | Solution |
| -------- | -------- |
| `ping: connect: Network is unreachable` | Le client n'a plus d'IP ou de route. 🖥️ `docker compose restart client` |
| `ip neigh flush all` affiche une erreur | Sans gravité, continuez |
| `traceroute` affiche des `* * *` | Attendez la fin, ou ajoutez `-w 1` pour accélérer |
