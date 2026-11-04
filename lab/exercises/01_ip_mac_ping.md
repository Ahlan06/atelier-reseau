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
| Adresse MAC        | `02:42:ac:14:01:32` (format Docker `02:42:ac:...`) |
| Adresse IP         | `172.20.1.50` |
| Masque (notation `/`) | `/24` (soit `255.255.255.0`) |
| Adresse du réseau  | `172.20.1.0/24` |

**Question A.2.** Le masque est `/24`. Combien de machines différentes peut-on placer dans ce réseau ?
(Indice : le dernier nombre de l'adresse peut varier de 0 à 255, mais 2 valeurs sont réservées.)

> 💬 **Votre réponse :**
>
> On peut placer **254 machines** dans ce réseau.
> - Le masque `/24` réserve 8 bits pour les hôtes ($2^8 = 256$ adresses au total).
> - Deux adresses sont réservées : l'adresse réseau (`172.20.1.0`) et l'adresse de diffusion/broadcast (`172.20.1.255`).
> - Il reste donc $256 - 2 = 254$ adresses utilisables pour des machines (de `172.20.1.1` à `172.20.1.254`).

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
> L'adresse de la passerelle est **`172.20.1.254`**. Elle correspond à la machine **`nat-router`** (le routeur / la « box » du lab, sur son interface LAN).

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
> - **Ligne apparue :** Une ligne associée à `172.20.1.2` (ex. `172.20.1.2 dev eth0 lladdr 02:42:ac:14:01:02 REACHABLE`).
> - **Contenu :** Elle associe l'adresse IP du serveur DHCP (`172.20.1.2`) à son adresse physique MAC (`lladdr`) sur l'interface `eth0`.
> - **Pourquoi avant le ping :** Pour émettre le paquet ICMP (couche 3) sur le lien Ethernet local (couche 2), il doit obligatoirement être encapsulé dans une trame Ethernet comportant l'adresse MAC du destinataire. Le client a donc exécuté au préalable une requête ARP (*Who has 172.20.1.2?*) pour obtenir cette MAC avant d'envoyer le ping.

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
> - Le client a appris la MAC de la **passerelle par défaut : `172.20.1.254`** (`nat-router`).
> - **Explication :** En comparant l'IP destination (`172.20.0.10`) avec son propre masque (`/24`), le client constate que cette machine n'est pas sur son réseau local. Les trames Ethernet de couche 2 ne traversent pas les routeurs, le client ne peut donc pas contacter directement `172.20.0.10` en ARP. Sa table de routage lui indique de passer par sa passerelle (`172.20.1.254`). Il demande donc la MAC de la passerelle via ARP et lui transmet la trame pour que le routeur se charge de l'acheminer.

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
> - Vers le routeur (`172.20.1.254`) : `ttl=64`.
> - Vers le site web (`172.20.0.10`) : `ttl=63`.
> - **Ils ne sont pas identiques.** Cette différence s'explique par le fait que chaque routeur traversé décrémente la valeur du TTL de 1. Le routeur répond directement sur le LAN (0 saut intermédiaire, donc TTL intact à 64). Pour joindre le site web sur le WAN, le paquet traverse le routeur `nat-router`, qui diminue le TTL de 1 ($64 - 1 = 63$).

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
> - **Nombre de sauts :** 2 sauts.
> - **Premier saut :** `172.20.1.254` (passerelle / routeur `nat-router`).
> - **Chemin suivi :**
>   `client (172.20.1.50) → nat-router (172.20.1.254 / 172.20.0.254) → internet (172.20.0.10)`

### Étape 8 — Le lab est isolé

💻 Essayez de joindre un vrai serveur d'Internet (le DNS de Google) :

```bash
ping -c 2 -W 2 8.8.8.8
```

**Question C.3.** Que se passe-t-il ? Pourquoi, selon vous ? (Pensez à ce qu'il y a derrière le routeur du lab.)

> 💬 **Votre réponse :**
>
> - **Constat :** Les pings échouent avec 100% de perte (`100% packet loss` ou `Destination Host Unreachable` / délai d'attente dépassé).
> - **Pourquoi :** Le lab est un réseau virtuel Docker isolé de l'extérieur (`enable_ip_masquerade: "false"`). Le réseau WAN ne contient que le routeur et le serveur web simulé `172.20.0.10`. Il n'y a aucune connexion ni passerelle vers le véritable Internet public derrière `nat-router` pour router vers `8.8.8.8`.

---

## Partie D — Synthèse

**Question D.1.** Complétez avec vos propres mots :

| Notion        | Explication en une phrase |
| ------------- | ------------------------- |
| Adresse IP    | Identifiant logique de couche 3 (réseau) permettant de localiser et router des paquets d'une machine à une autre à travers différents réseaux. |
| Adresse MAC   | Identifiant physique de couche 2 (liaison) propre à une carte réseau, utilisé pour acheminer les trames sur le réseau local direct. |
| Passerelle    | Routeur par défaut vers lequel une machine dirige ses paquets lorsqu'ils sont destinés à un autre réseau que le sien. |
| ARP           | Protocole de résolution d'adresses permettant d'obtenir l'adresse MAC correspondant à une adresse IP sur un même réseau local. |
| TTL           | Compteur (*Time To Live*) de l'en-tête IP décrémenté par chaque routeur traversé pour empêcher un paquet de tourner indéfiniment en boucle. |

**Question D.2.** Vrai ou faux ? Justifiez : « Pour envoyer un paquet à `172.20.0.10`, le client met
dans la trame la MAC de `172.20.0.10`. »

> 💬 **Votre réponse :**
>
> **Faux.**
> `172.20.0.10` se situe sur un réseau distant (WAN). Le client ne peut pas joindre cette IP directement en couche 2 et ne connaît pas sa MAC. Le client encapsule donc le paquet IP (qui a bien pour IP de destination `172.20.0.10`) dans une trame Ethernet dont l'**adresse MAC de destination est celle de sa passerelle** (`172.20.1.254`). C'est le routeur qui se chargera ensuite de réencapsuler le paquet dans une nouvelle trame avec la MAC de destination finale.

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
