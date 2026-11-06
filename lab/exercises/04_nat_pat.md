# Exercice 4 — NAT / PAT : comment le LAN sort sur Internet

**Niveau :** ⭐⭐⭐ · **Durée :** ~1 h
**📖 Fiche théorique à lire avant :** `https://<votre-site>.pythonanywhere.com/nat`

## 🎯 Objectifs

- Constater que le serveur web ne voit **jamais** l'adresse privée du client.
- Lire la **table de traduction** du routeur (`conntrack`).
- **Casser** le NAT, observer la panne, puis le **réparer**.

> 🖥️ Préparation : lab démarré. Ouvrez un **terminal routeur** 🔀 (`docker exec -it lab_nat_router bash`),
> un **terminal client** 💻 (`docker exec -it lab_client bash`) et gardez un terminal Codespace 🖥️.

> 💡 L'adresse du client est `172.20.1.50`, ou l'adresse obtenue par DHCP à l'exercice 3
> (`172.20.1.1xx`). Utilisez **la vôtre** dans les réponses (`ip -br addr show eth0`).

---

## Partie A — Le routeur et sa règle NAT

### Étape 1 — Les deux pattes du routeur

🔀 **Terminal routeur** :

```bash
ip -br addr
```

👀 Le routeur a deux interfaces : **`lan`** (`172.20.1.254`, côté réseau local) et **`wan`**
(`172.20.0.254`, côté « Internet »).

### Étape 2 — La règle MASQUERADE

🔀 Affichez les règles de traduction appliquées aux paquets qui **sortent** du routeur :

```bash
iptables -t nat -L POSTROUTING -n -v --line-numbers
```

👀 Une règle n°1 : `MASQUERADE … out wan`. En français : « tout paquet qui sort par `wan`
prend comme adresse source **celle du routeur** ».

### Étape 3 — Ce que voit le serveur web

💻 **Terminal client** :

```bash
curl http://172.20.0.10/whoami
```

🖥️ **Terminal Codespace** — le journal du serveur web :

```bash
docker logs --tail 3 lab_internet
```

👀 Les lignes du journal contiennent `FROM=…` : l'adresse que le serveur a vue.

**Question A.1.** Quelle adresse le serveur web voit-il ? Est-ce l'adresse du client ? De quelle machine s'agit-il ?

> 💬 **Votre réponse :**
>
> Le serveur web voit l'adresse IP `172.20.0.254` (confirmé par `FROM=172.20.0.254` dans les logs nginx et la réponse de `/whoami`).
> Ce n'est pas l'adresse IP du client (`172.20.1.50`). Il s'agit de l'adresse de l'interface WAN du routeur `nat-router`.

**Question A.2.** Les adresses `172.20.x.x`, `192.168.x.x` et `10.x.x.x` sont des **adresses privées**
(voir la fiche). Pourquoi un vrai serveur sur Internet ne pourrait-il pas répondre à une adresse privée ?

> 💬 **Votre réponse :**
>
> Les plages privées (RFC 1918) ne sont pas routables sur l'Internet public : les routeurs de transit (BGP) les ignorent et ne les propagent pas. De plus, ces adresses sont réutilisées par des millions de réseaux locaux dans le monde, donc un serveur externe n'aurait aucun moyen de savoir à quelle machine ni à quel réseau physique renvoyer les paquets.

---

## Partie B — La table de traduction

### Étape 4 — Vider la table

🔀 **Terminal routeur** — effacez la table pour partir de zéro :

```bash
conntrack -F
```

### Étape 5 — Envoyer trois requêtes

💻 **Terminal client** :

```bash
curl -s http://172.20.0.10/whoami
curl -s http://172.20.0.10/whoami
curl -s http://172.20.0.10/whoami
```

### Étape 6 — Lire la table

🔀 **Terminal routeur** :

```bash
conntrack -L -p tcp
```

👀 Une ligne par connexion. Chaque ligne contient **deux groupes** `src= dst= sport= dport=` :

```
tcp 6 119 TIME_WAIT src=172.20.1.50 dst=172.20.0.10 sport=52942 dport=80 src=172.20.0.10 dst=172.20.0.254 sport=80 dport=52942 [ASSURED] ...
                    └─────────────── ALLER (vu par le client) ───────────┘ └─────────────── RETOUR (vu par le serveur) ────────────┘
```

**Question B.1.** Recopiez **une** ligne de votre table et complétez :

| Sens   | IP source | IP destination | Port source | Port destination |
| ------ | --------- | -------------- | ----------- | ---------------- |
| Aller  | `172.20.1.50` | `172.20.0.10` | `52942` | `80` |
| Retour | `172.20.0.10` | `172.20.0.254` | `80` | `52942` |

Dans le sens **retour**, à quelle adresse le serveur répond-il ? Qui fait la traduction vers le client ?

> 💬 **Votre réponse :**
>
> Au retour, le serveur web répond à l'adresse WAN du routeur : `172.20.0.254`. C'est le routeur `nat-router` qui consulte sa table de suivi de connexions (`conntrack`), remplace l'IP destination par l'IP privée du client (`172.20.1.50`) et lui transmet le paquet sur le LAN.

**Question B.2.** Combien de lignes voyez-vous pour vos 3 requêtes ? Les **ports source** sont-ils
identiques ? Pourquoi est-ce indispensable quand plusieurs PC partagent la même adresse publique ?

> 💬 **Votre réponse :**
>
> On voit 3 lignes (une par session TCP). Les ports source côté client sont différents pour chaque connexion (ex. `52942`, `52944`, `52946`).
> C'est indispensable car quand plusieurs PC partagent une seule adresse IP publique, le routeur utilise le port pour démultiplexer les flux de retour. Sans ports distincts, le routeur ne pourrait pas savoir à quelle machine du réseau local réexpédier la réponse reçue.

**Question B.3.** On parle de **PAT** (*Port Address Translation*) quand plusieurs machines partagent
**une seule** IP publique grâce aux ports. Notre routeur fait-il du NAT simple ou du PAT ? Justifiez.

> 💬 **Votre réponse :**
>
> Le routeur fait du **PAT** (NAT overload / Masquerade).
> En effet, tous les conteneurs du LAN partagent l'unique adresse IP WAN du routeur (`172.20.0.254`). C'est la combinaison de cette IP et des numéros de ports sources qui permet de différencier les connexions des différents hôtes.

---

## Partie C — Casser le NAT… puis le réparer

### Étape 7 — Supprimer la règle

🔀 **Terminal routeur** :

```bash
iptables -t nat -D POSTROUTING 1
iptables -t nat -L POSTROUTING -n -v --line-numbers
```

👀 La règle MASQUERADE a disparu.

### Étape 8 — Observer la panne

🔀 **Terminal routeur** — écoutez ce qui sort côté WAN :

```bash
tcpdump -i wan -nn -c 4 host 172.20.0.10
```

💻 **Terminal client** — tentez une requête (abandon au bout de 5 secondes) :

```bash
curl -m 5 http://172.20.0.10/whoami
```

🖥️ **Terminal Codespace** :

```bash
docker logs --tail 3 lab_internet
```

**Question C.1.** Que se passe-t-il côté client ? Une nouvelle ligne apparaît-elle dans le journal du serveur web ?

> 💬 **Votre réponse :**
>
> Côté client, la requête se bloque et se termine en timeout au bout de 5 secondes (`curl: (28) Connection timed out after 5000 milliseconds`).
> Aucune nouvelle ligne n'apparaît dans le journal de `lab_internet` car le handshake TCP n'a pas pu aboutir (pas de requête HTTP reçue par nginx).

**Question C.2.** Dans la capture côté WAN, quelle **IP source** porte le paquet `[S]` (SYN) qui sort ?
Le paquet **aller** est bien parti : pourquoi la **réponse** ne revient-elle jamais au client ?

> 💬 **Votre réponse :**
>
> Le paquet SYN porte l'IP source `172.20.1.50` (l'adresse privée du client, non traduite).
> Le paquet aller arrive bien jusqu'au serveur web, mais pour envoyer son SYN-ACK, le serveur web doit répondre à destination de `172.20.1.50`. Le serveur étant sur le réseau `172.20.0.0/24`, il ne sait pas comment joindre `172.20.1.0/24` (pas de route de retour vers le LAN), donc la réponse est perdue et n'atteint jamais le client.

### Étape 9 — Réparer

🔀 **Terminal routeur** (<kbd>Ctrl</kbd>+<kbd>C</kbd> pour arrêter tcpdump s'il tourne encore) :

```bash
iptables -t nat -A POSTROUTING -o wan -j MASQUERADE
```

💻 **Terminal client** :

```bash
curl http://172.20.0.10/whoami
```

👀 Le site répond à nouveau avec `172.20.0.254`.

---

## Partie D — Synthèse

**Question D.1.** Expliquez en 3-4 phrases, avec vos mots, le trajet d'une requête du client vers
le serveur web **et** de sa réponse, en indiquant à quel moment l'adresse est traduite.

> 💬 **Votre réponse :**
>
> Le client envoie son paquet au routeur avec son IP source privée (`172.20.1.50`) et l'IP du serveur (`172.20.0.10`). En traversant le routeur vers le WAN (étape POSTROUTING), la règle NAT remplace l'IP source par celle du routeur (`172.20.0.254`) et garde la session en mémoire dans `conntrack`. Le serveur web reçoit la requête et renvoie sa réponse à destination de `172.20.0.254`. À la réception, le routeur consulte `conntrack`, réécrit l'IP de destination avec celle du client (`172.20.1.50`) et lui transmet la réponse sur le LAN.

**Question D.2.** Chez vous, combien d'adresses IP publiques votre box possède-t-elle en général ?
Combien d'appareils l'utilisent ? Quel mécanisme rend cela possible ?

> 💬 **Votre réponse :**
>
> La box possède en général une seule adresse IPv4 publique. Pourtant, plusieurs dizaines d'appareils (PC, téléphones, consoles...) peuvent être connectés simultanément. C'est le PAT (NAT overload / Masquerade) qui rend cela possible en associant à chaque connexion un port source unique côté public.

**Question D.3.** Pourquoi le NAT a-t-il été inventé ? (Indice : combien existe-t-il d'adresses IPv4 au total ?)

> 💬 **Votre réponse :**
>
> Le NAT a été inventé pour retarder l'épuisement des adresses IPv4 (limitées à environ 4,3 milliards d'adresses sur 32 bits). En permettant à tout un réseau privé de partager une seule adresse IP publique, il a évité de devoir attribuer une adresse publique routable à chaque terminal connecté à Internet.

---

## 🚀 Pour aller plus loin (facultatif) — la redirection de port

Sur une box, la « redirection de port » permet de rendre joignable un service situé derrière
le routeur. C'est un **DNAT** (NAT sur l'adresse de **destination**).

🔀 **Terminal routeur** — redirigez le port `8080` du routeur vers le port `80` du serveur web :

```bash
iptables -t nat -A PREROUTING -i lan -p tcp --dport 8080 -j DNAT --to-destination 172.20.0.10:80
```

💻 **Terminal client** — interrogez **le routeur** sur le port 8080 :

```bash
curl http://172.20.1.254:8080/whoami
```

🔀 Regardez la traduction : `conntrack -L -p tcp | grep 8080`

**Question P.1.** Le client a demandé `172.20.1.254:8080`. Qui a réellement répondu ? Dans la ligne
`conntrack`, qu'est-ce qui a été traduit cette fois : la source, la destination, ou les deux ?

> 💬 **Votre réponse :**
>
> C'est le serveur web `172.20.0.10` qui a répondu.
> Dans la table `conntrack`, c'est l'**adresse et le port de destination** qui ont été traduits (DNAT) : à l'aller, `dst=172.20.1.254:8080` a été réécrit en `dst=172.20.0.10:80`.

**Question P.2.** Donnez un exemple de situation où vous auriez besoin d'une redirection de port chez vous.

> 💬 **Votre réponse :**
>
> Quand on veut héberger un serveur chez soi sur son LAN et y accéder depuis l'extérieur (depuis Internet) : par exemple un serveur de jeu (Minecraft), un serveur SSH pour administrer une machine à distance, ou un serveur de fichiers (NAS / Nextcloud).

🔀 Nettoyage : `iptables -t nat -D PREROUTING 1`

---

## ✅ Ce qu'il faut retenir

- Les adresses privées ne circulent pas sur Internet : le routeur les **remplace** par son adresse publique.
- La table `conntrack` mémorise chaque traduction pour renvoyer les réponses au bon client.
- Le **PAT** utilise les **ports** pour que plusieurs machines partagent une seule IP publique.
- Sans NAT, le paquet aller part, mais la **réponse** ne trouve pas le chemin du retour.

## 🆘 En cas de problème

| Problème | Solution |
| -------- | -------- |
| `# Warning: iptables-legacy tables present…` | Simple avertissement, ignorez-le |
| `curl` ne répond plus après la partie C | La règle n'a pas été remise : refaites l'étape 9 |
| `conntrack -L` est vide | Les entrées disparaissent après 2 min : relancez les `curl` de l'étape 5 |
| Tout est cassé | 🖥️ `docker compose restart nat-router` recrée les règles d'origine |
