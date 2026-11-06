# Exercice 5 (Bonus) — Un faux serveur DHCP sur le réseau

**Niveau :** ⭐⭐⭐ · **Durée :** ~45 min
**📖 Fiche théorique à relire :** `https://<votre-site>.pythonanywhere.com/dhcp` (section *Points de vigilance*)

## 🎯 Objectifs

- Comprendre pourquoi DHCP est **vulnérable** : le client fait confiance au premier serveur qui répond.
- Observer un faux serveur (*rogue DHCP*) détourner un client.
- Utiliser un petit script de **détection**.

> ⚠️ Cette attaque se fait **uniquement dans le lab**. Lancer un faux serveur DHCP sur un vrai
> réseau (école, entreprise, Wi-Fi public) est **interdit** et perturbe tous les utilisateurs.

> 🖥️ Préparation : avoir terminé l'exercice 3. Ouvrez **deux terminaux client** 💻 et gardez un terminal Codespace 🖥️.

---

## Partie A — L'attaquant arrive

Un cinquième conteneur, `rogue-dhcp` (`172.20.1.99`), est déjà préparé dans le lab mais ne démarre
pas par défaut. Sa configuration ([`lab/rogue/dnsmasq.conf`](../rogue/dnsmasq.conf)) distribue des
adresses avec **lui-même comme passerelle et comme DNS**.

🖥️ **Terminal Codespace** (dans le dossier `lab`) :

```bash
docker compose --profile bonus up -d rogue-dhcp
docker compose --profile bonus ps
```

👀 Il y a maintenant **5** machines, dont `lab_rogue_dhcp`.

**Question A.1.** Ouvrez le fichier `lab/rogue/dnsmasq.conf` dans Codespace. Quelle passerelle et quel
DNS ce serveur donne-t-il aux clients ? Comparez avec `lab/dhcp-server/dnsmasq.conf`.

> 💬 **Votre réponse :**
>
> Le faux serveur (`lab/rogue/dnsmasq.conf`) distribue sa propre adresse IP comme passerelle et comme DNS :
> - Passerelle : `172.20.1.99`
> - DNS : `172.20.1.99`
> - Plage : `172.20.1.150,172.20.1.160` avec un bail court de 1h.
>
> À l'inverse, le vrai serveur légitime (`lab/dhcp-server/dnsmasq.conf`) donne le routeur `172.20.1.254` comme passerelle et des DNS externes légitimes (`1.1.1.1, 8.8.8.8`). Le pirate tente donc d'attirer tout le trafic et les résolutions DNS du client vers lui.

---

## Partie B — La course aux offres

### Étape 1 — Écouter les offres

💻 **Terminal client n°1** — affichez chaque **Offer** reçue (serveur, IP proposée, passerelle proposée) :

```bash
tshark -i eth0 -l -Y "dhcp.option.dhcp == 2" -T fields \
  -e dhcp.option.dhcp_server_id -e dhcp.ip.your -e dhcp.option.router 2>/dev/null
```

### Étape 2 — Demander une adresse

💻 **Terminal client n°2** — demandez une nouvelle adresse, puis regardez votre passerelle :

```bash
dhclient -r eth0; rm -f /var/lib/dhcp/dhclient.leases
dhclient -v eth0
ip route
```

Répétez l'étape 2 **trois fois**.

**Question B.1.** Combien d'**Offers** voyez-vous dans le terminal n°1 pour chaque demande ?
De quels serveurs viennent-elles ?

> 💬 **Votre réponse :**
>
> On voit 2 Offers à chaque diffusion de Discover :
> - Une envoyée par le serveur légitime (`172.20.1.2`).
> - Une envoyée par le faux serveur pirate (`172.20.1.99`).

**Question B.2.** Quelle offre le client a-t-il acceptée (ligne `DHCPOFFER of … from …` et `ip route`) ?
D'après vous, selon quel critère le client choisit-il ?

> 💬 **Votre réponse :**
>
> Le client retient l'offre du serveur pirate (`172.20.1.99`), qui attribue une IP dans la plage `172.20.1.15x` et configure la passerelle par défaut `default via 172.20.1.99`.
> En DHCP, le client n'authentifie pas les serveurs : il prend simplement la **première offre qui arrive** sur le câble (*first come, first served*).

---

## Partie C — Les conséquences

### Étape 3 — Tenter d'accéder à Internet

💻 **Terminal client n°2** — essayez d'accéder au site web :

```bash
ip route
```

```bash
curl -m 5 http://172.20.0.10/whoami
```

**Question C.1.** Le site répond-il ? Expliquez pourquoi, en regardant la passerelle du client.

> 💬 **Votre réponse :**
>
> Non, la commande tombe en timeout après 5 secondes.
> La passerelle du client pointe sur `172.20.1.99` (le conteneur rogue) au lieu de la box `172.20.1.254`. Comme la machine pirate ne route pas les paquets et n'est pas connectée au WAN, le trafic est envoyé dans le vide et ne sort jamais du LAN.

**Question C.2.** Ici, le faux serveur ne fait pas suivre le trafic : le client perd simplement son accès.
Un vrai attaquant ferait suivre le trafic **tout en le lisant**. Que pourrait-il voir ou modifier ?
(Pensez aussi au **DNS** qu'il a distribué.)

> 💬 **Votre réponse :**
>
> C'est une attaque de type **Man-in-the-Middle (MitM)** :
> 1. En activant le routage, l'attaquant pourrait espionner tout le trafic sortant non chiffré (mots de passe HTTP, données personnelles, métadonnées de connexion, requêtes non sécurisées).
> 2. Avec le faux DNS qu'il a imposé, il peut réaliser du **DNS spoofing** : quand l'utilisateur tape le nom de domaine d'une banque ou d'un webmail, le pirate renvoie l'IP de son propre faux serveur pour afficher une page de phishing et voler ses identifiants.

---

## Partie D — Détecter l'attaque

Un script de détection est fourni : [`detect_rogue_dhcp.sh`](detect_rogue_dhcp.sh). Ouvrez-le et lisez-le.

💻 Arrêtez tshark dans le **terminal client n°1** (<kbd>Ctrl</kbd>+<kbd>C</kbd>) et ressortez du client (`exit`).
Dans ce même terminal, depuis la racine du dépôt 🖥️, lancez le détecteur sur le poste client :

```bash
docker exec -i lab_client bash < lab/exercises/detect_rogue_dhcp.sh
```

💻 **Terminal client n°2** — redemandez une adresse :

```bash
dhclient -r eth0; rm -f /var/lib/dhcp/dhclient.leases
dhclient -v eth0
```

👀 Le détecteur affiche une ligne `OK` pour le vrai serveur et une ligne `ALERTE` pour l'intrus.

**Question D.1.** Recopiez la sortie du détecteur.

> 💬 **Votre réponse :**
>
> ```text
> Surveillance des offres DHCP sur eth0 (Ctrl+C pour arrêter)...
> OK     : offre du serveur autorisé 172.20.1.2
> ALERTE : serveur DHCP NON autorisé détecté : 172.20.1.99
> ```

**Question D.2.** Expliquez avec vos mots ce que fait le script : quelle information lit-il dans
chaque Offer, et comment décide-t-il de lever une alerte ?

> 💬 **Votre réponse :**
>
> Le script écoute le trafic réseau avec `tshark` en filtrant uniquement les paquets DHCP Offer (type 2). Pour chaque paquet reçu, il extrait l'option 54 (`dhcp.option.dhcp_server_id`), qui donne l'IP du serveur qui propose l'offre. Il compare ensuite cette adresse à `172.20.1.2` : si c'est elle, il affiche `OK`, sinon il lève une `ALERTE`.

**Question D.3.** Ce script **détecte** l'attaque, mais l'**empêche**-t-il ? Sur les vrais réseaux, les
switchs proposent une protection appelée **DHCP Snooping** : seuls les ports déclarés « de confiance »
ont le droit d'envoyer des Offers. Expliquez pourquoi cette solution est plus efficace.

> 💬 **Votre réponse :**
>
> Non, le script ne fait qu'alerter après coup : le client a déjà reçu l'offre et a potentiellement déjà configuré la mauvaise passerelle.
> Le **DHCP Snooping** est bien plus efficace car il agit en amont au niveau matériel (sur le switch) : le switch bloque et détruit directement les trames `DHCPOFFER` et `DHCPACK` qui arrivent sur des ports d'utilisateurs non autorisés (ports *untrusted*). Le faux serveur ne peut donc même pas faire parvenir ses réponses aux machines du réseau.

---

## Nettoyage

🖥️ Arrêtez le détecteur (<kbd>Ctrl</kbd>+<kbd>C</kbd>), supprimez le faux serveur, puis remettez le client à zéro :

```bash
docker compose --profile bonus stop rogue-dhcp
docker compose --profile bonus rm -f rogue-dhcp
docker compose restart client
```

---

## ✅ Ce qu'il faut retenir

- DHCP n'authentifie pas les serveurs : le client accepte en général **la première offre** reçue.
- Un faux serveur peut imposer sa **passerelle** et son **DNS**, et donc détourner tout le trafic.
- On peut **détecter** les offres illégitimes (surveillance) et les **bloquer** (DHCP Snooping sur les switchs).

## 🆘 En cas de problème

| Problème | Solution |
| -------- | -------- |
| `no such service: rogue-dhcp` | N'oubliez pas `--profile bonus` dans la commande |
| Le vrai serveur gagne à chaque fois | C'est possible ! Répétez la demande plusieurs fois et comparez |
| Le détecteur n'affiche rien | Vérifiez qu'il tourne bien, puis relancez `dhclient` dans l'autre terminal |
| `bash: lab/exercises/detect_rogue_dhcp.sh: No such file` | Placez-vous à la racine du dépôt : `cd /workspaces/*/` |
