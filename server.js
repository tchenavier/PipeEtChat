// Importations
const { WebSocketServer } = require('ws');
const express = require('express'); // var expresse prend expresse pour le http
const mysql = require('mysql2');
const path = require('path');//fournit des utilitaires pour travailler avec les chemins de fichiers et de répertoires
require('dotenv').config();

const app = express(); // instasie expresse

// Configuration Variables d'environnement
const Utilisateur = process.env.Utilisateur;
const Mot_Passe = process.env.Mot_Passe;
const Table = process.env.Table;
const Adresse = process.env.Adresse;

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
            connection.query('SELECT id,login FROM utilisateur WHERE login = ? ', [login], (err, results) => {//Pour ne renvoyer que l'id le login et l'id du role
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
                    connection.query( //sert a envoyer les donner au serveur
                        'INSERT INTO utilisateur (`login`, `pasword`) VALUES (?,?)',
                        [login, pasword],
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
            connection.query('SELECT id,login FROM utilisateur WHERE login = ? AND pasword = ?', [login, pasword], (err, results) => {//Pour ne renvoyer que l'id le login et l'id du role
                if (err) {
                    console.error('Erreur lors de la vérification des identifiants :', err);
                    res.status(500).json({ message: 'Erreur serveur' });
                    return;
                }
                if (results.length === 0) {
                    res.status(401).json({ message: 'Identifiants invalides' });
                    return;
                }
                // Identifiants valides 
                //renvoi les informations du user
                res.status(202).json({ user: results[0] });
            });
        }
    }


});

app.post('/message', (req, res) => {
    const { login, pasword, message, idSalon } = req.body;
    connection.query('SELECT id,login,idSalon FROM utilisateur,AssociationSalon WHERE login = ? AND pasword = ?', [login, pasword], (err, results) => {
        if (err) {
            console.error('Erreur lors de la vérification des identifiants :', err);
            res.status(500).json({ message: 'Erreur serveur' });
            return;
        }
        else if (results.length === 0) {
            res.status(401).json({ message: 'Identifiants invalides' });
            return;
        }
        else {
            connection.query('INSERT INTO Message (`idSalon`, `idUtilisateur`, `text`) VALUES (?,?,?)', [idSalon, results[0].id, message], (err, results) => {
                if (err) {
                    console.error('Erreur lors de l\'insertion du message dans la base de données :', err);
                    res.status(500).json({ message: 'Erreur serveur' });
                    return;
                }
                else if (results.length === 0) {
                    res.status(401).json({ message: 'Identifiants invalides' });
                    return;
                }
                else {
                    console.log('Message inséré avec succès, ID du message :', results.insertId);
                    connection.query('INSERT INTO AssociationMessage (idSalon, idMessage) VALUES (?,?)', [idSalon, results.insertId], (err, results) => {
                        if (err) {
                            console.error('Erreur lors de l\'association du message au salon dans la base de données :', err);
                            res.status(500).json({ message: 'Erreur serveur' });
                            return;
                        }
                        else if (results.length === 0) {
                            res.status(401).json({ message: 'Identifiants invalides' });
                            return;
                        }
                        else {
                            res.status(200).json({ message: 'Message envoyé !' });
                            return;
                        }
                    });
                }
            });
        }
    });
});

app.post('/pull-message', (req, res) => {
    const { login, pasword, message, idSalon } = req.body;
    connection.query('SELECT id,login FROM utilisateur WHERE login = ? AND pasword = ?', [login, pasword], (err, results) => {
        if (err) {
            console.error('Erreur lors de la vérification des identifiants :', err);
            res.status(500).json({ message: 'Erreur serveur' });
            return;
        }
        else if (results.length === 0) {
            res.status(401).json({ message: 'Identifiants invalides' });
            return;
        } else {
            connection.query('SELECT text FROM Message,AssosiationMessage WHERE idSalon = ? AND idMessage = Message.id', [idSalon], (err, results) => {
                if (err) {
                    console.error('Erreur lors de la récupération des messages :', err);
                    res.status(500).json({ message: 'Erreur serveur' });
                    return;
                } else if (results.length === 0) {
                    res.status(401).json({ message: 'Identifiants invalides' });
                    return;
                } else {
                    res.status(200).json({ messages: results });
                    return;
                }
            });
        }
    });
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
    console.log('Clien connected');
    clients.push(socket);

    socket.on('message', (data) => {
        // En WS moderne, 'data' est un Buffer, il faut le convertir en string
        const message = data.toString();
        console.log(`Reçu : ${message}`);

        for (var i = 0; i < clients.length; i++) {
            clients[i].send(`Serveur : ${message}`);
        }
        //socket.send('Server: ${message}');
    });

    socket.on('rejoindre-Salon', (salondID) => {
        console.log(`Client ${socket.id} a rejoint le salon : ${salondID.nom}`);
        socket.join(salondID); // Rejoindre le salon
        socket.emit('salon-rejoint', `Vous avez rejoint le salon : ${salondID.nom}`); // Confirmer au client qu'il a rejoint le salon
        socket.to(salondID).emit('message', `${socket.nom} a rejoint le salon : ${salondID.nom}`); // Informer les autres membres du salon
    })

    socket.on('quiter-salon', (data) => {
        console.log(`Client ${socket.id} a quitté le salon : ${salondID.nom}`);
        socket.leave(salondID); // Quitter le salon
        socket.emit('salon-quitte', `Vous avez quitté le salon : ${salondID.nom}`); // Confirmer au client qu'il a quitté le salon
        socket.to(salondID).emit('message', `${socket.nom} a quitté le salon : ${salondID.nom}`); // Informer les autres membres du salon
    })

    //Retire le socket du tableau de clients
    socket.on('close', () => {
        console.log('Client disconnected');
        var index = clients.indexOf(socket);
        if (index !== -1) {
            clients.splice(index, 1);
        }
    });

});

