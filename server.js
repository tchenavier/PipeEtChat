// Importations
const { WebSocketServer } = require('ws');
const express = require('express'); // var expresse prend expresse pour le http
const mysql = require('mysql2');
const path = require('path');//fournit des utilitaires pour travailler avec les chemins de fichiers et de répertoires
require('dotenv').config();
const bcrypt = require('bcrypt');

const app = express(); // instasie expresse

// Configuration Variables d'environnement
const Utilisateur = process.env.Utilisateur;
const Mot_Passe = process.env.Mot_Passe;
const Table = process.env.Table;
const Adresse = process.env.Adresse;
const ValeurHash = process.env.ValeurHash;

// Connexion MySQL
const connection = mysql.createConnection({
    host: Adresse,//localhost si votre node est sur la même VM que votre Bdd
    user: Utilisateur,//non utilisateur
    password: Mot_Passe,//son mode de passe
    database: Table//table viser
});

connection.connect((err) => {
    if (err) {
        console.error('Erreur de connexion à la base de données :', err);
        return;
    }
    console.log('Connecté à la base de données MySQL.');
});

// Middleware
app.use(express.static('public'));
app.use(express.json());

app.post('/register', (req, res) => { //enregistrement des utilisateur
    console.log('Données reçues pour l\'inscription');
    console.log(req.body);
    const { login, pasword } = req.body;

    if (typeof login !== 'string' || typeof pasword !== 'string') {
        return res.status(400).json({ error: 'La saisie doit être une chaîne de caractères.' });
    }
    else {
        // Calcul de la longueur (UTF-16)
        const loginLength = login.length;
        const paswordLength = pasword.length;

        // longueur minimale et maximale
        if (loginLength <= 0 || paswordLength <= 0) {
            return res.status(400).json({ error: '' });
        }
        else if (loginLength > 25 || paswordLength > 25) {
            return res.status(400).json({ error: '' });
        }
        else {
            connection.query('SELECT id,login FROM User WHERE login = ? ', [login], (err, results) => {//Pour ne renvoyer que l'id le login
                if (err) {
                    console.error('Erreur lors de la vérification des identifiants :', err);
                    res.status(500).json({ message: 'Erreur serveur' });
                    return;
                }
                else if (results.length !== 0) {
                    res.status(401).json({ message: '' });
                    return;
                }
                else {
                    const hashedPassword = bcrypt.hashSync(pasword, parseInt(ValeurHash)); // Hash du mot de passe avec bcrypt
                    connection.query( //sert a envoyer les donner au serveur
                        'INSERT INTO User (`login`, `pasword`) VALUES (?,?)',
                        [login, hashedPassword],
                        (err, results) => {
                            if (err) {
                                console.error('Erreur lors de l\'insertion dans la base de données :', err);
                                res.status(500).json({ message: 'Erreur serveur' });
                                return;
                            }
                            else {
                                console.log('Insertion réussie, ID utilisateur :', results.insertId);
                                res.status(200).json({ message: 'Inscription réussie !', userId: results.insertId });
                                return;
                            }

                        }
                    );

                }
            }
            );
        }
    }
});

app.post('/connexion', (req, res) => {
    console.log(req.body);
    //on récupère le login et le password
    const { login, pasword } = req.body;
    const hashedPassword = bcrypt.hashSync(pasword, parseInt(ValeurHash)); // Hash du mot de passe avec bcrypt
    if (typeof login !== 'string' || typeof pasword !== 'string') {
        return res.status(400).json({ error: 'La saisie doit être une chaîne de caractères.' });
    }
    else {
        // Calcul de la longueur (UTF-16)
        const loginLength = login.length;
        const paswordLength = pasword.length;

        // longueur minimale et maximale
        if (loginLength <= 0 || paswordLength <= 0) {
            return res.status(400).json({ error: '' });
        }
        else if (loginLength > 25 || paswordLength > 25) {
            return res.status(400).json({ error: '' });
        }
        else {
            connection.query('SELECT id,login FROM User WHERE login = ? AND pasword = ?', [login, hashedPassword], (err, results) => {//Pour ne renvoyer que l'id le login et l'id du role
                if (err || results.length === 0) {
                    res.status(401).json({ message: 'Identifiants invalides' });
                    return;
                }

                const user = results[0];
                const match = bcrypt.compareSync(pasword, user.pasword);

                if (match) {
                    // Identifiants valides 
                    //renvoi les informations du user
                    res.status(202).json({ user: { id: user.id, login: user.login } });
                    return;
                } else {
                    res.status(401).json({ message: 'Identifiants invalides' });
                    return;
                }
            });
        }
    }
});

app.listen(9000, () => { //express écoute sur le port 3000 et affiche un message dans la console
    console.log('server runing')
});  //Le poind virgule c'est juste pour dire la fin de la fonction


//Web Socket Server

const server = new WebSocketServer({
    port: 9001
});

var clients = [];

server.on('connection', (socket) => {
    console.log('Clien connecte');
    clients.push(socket);
    
        //Pour récupérer les ancien messages du salon
        connection.query('SELECT Message.text, User.login, Message.idSalon FROM Message,User WHERE Message.idUser = User.id AND idSalon = ? ORDER BY Message.id DESC LIMIT 100', [idSalon], (err, results) => {
        if (err) {
            console.error('Erreur historique SQL :', err);
        } else {
            // On inverse les résultats pour les envoyer dans l'ordre chronologique
            const history = results.reverse();
            
            // On envoie l'historique uniquement au client qui vient de se connecter
            socket.send(JSON.stringify({
                type: 'history',
                data: history
            }));
        }
    });

    socket.on('message', (data) => {

        try { //pour éviter que le serveur s'arrête en cas de message jason mal formé
            const message = data.toString();
            const messageData = JSON.parse(rawMessage);

            // En WS moderne, 'data' est un Buffer, il faut le convertir en string
            console.log(`Reçu : ${message}`);
            const { userId, text, idSalon } = JSON.parse(message);

            connection.query('INSERT INTO Message (`idSalon`, `idUser`, `text`) VALUES (?,?,?)', [idSalon, userId, text], (err, results) => {
                if (err) {
                    console.error('Erreur lors de l\'insertion du message dans la base de données :', err);
                    socket.send(JSON.stringify({ type: 'error', message: 'Erreur lors de la sauvegarde.' }));
                    return;
                }
                else {
                    console.log('Message inséré avec succès, ID du message :', results.insertId);
                    const broadcastMessage = JSON.stringify({ message: text, idSalon: idSalon, userId: userId });
                    for (var i = 0; i < clients.length; i++) {
                        clients[i].send(broadcastMessage);
                    }
                }
                //preparation du message
                const broadcastMessage = JSON.stringify({
                    message: text,
                    idSalon: idSalon,
                    userId: userId
                });
                //envoi du message a tous les clients connecter
                for (var i = 0; i < clients.length; i++) {
                    clients[i].send(broadcastMessage);
                }
                return;
            });
         // deuxième partie du try
            } catch (error) {
            console.error('Erreur de formatage JSON reçu :', error);
            socket.send(JSON.stringify({ type: 'error', message: 'Format JSON invalide.' }));
        }
    });
    //Retire le socket du tableau de clients
    socket.on('close', () => {
        console.log('Client disconnected');
        var index = clients.indexOf(socket);
        if (index !== -1) {
            clients.splice(index, 1);
        }
    });

    socket.on('error', (err) => {
        console.error('Erreur Socket:', err);
    });

});

