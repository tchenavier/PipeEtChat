const { WebSocketServer } = require('ws');
const express = require('express'); 
const mysql = require('mysql2');
const path = require('path');
require('dotenv').config();
const bcrypt = require('bcrypt');

const app = express();

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
    
    if (login.length <= 3 || pasword.length <= 3 || login.length > 25 || pasword.length > 25) {
        return res.status(400).json({ error: 'Longueur des identifiants invalide (entre 4 et 25 caractères).' });
    }

    connection.query('SELECT id, login FROM User WHERE login = ? ', [login], (err, results) => {
        if (err) {
            console.error('Erreur SQL (SELECT) :', err);
            return res.status(500).json({ message: 'Erreur serveur' });
        }
        
        if (results.length !== 0) {
            return res.status(401).json({ message: 'Ce nom d\'utilisateur existe déjà.' });
        }
        
        const hashedPassword = bcrypt.hashSync(pasword, parseInt(ValeurHash)); 
        connection.query(
            'INSERT INTO User (`login`, `pasword`) VALUES (?, ?)',
            [login, hashedPassword],
            (err, results) => {
                if (err) {
                    console.error('Erreur SQL (INSERT) :', err);
                    return res.status(500).json({ message: 'Erreur serveur' });
                }
                console.log('Insertion réussie :', results.insertId);
                res.status(200).json({ message: 'Inscription réussie !', userId: results.insertId });
            }
        );
    });
});

// ── Connexion ─────────────────────────────────────
app.post('/connexion', (req, res) => {
    console.log('Données de connexion :', req.body);
    const { login, pasword } = req.body;

    if (typeof login !== 'string' || typeof pasword !== 'string') {
        return res.status(400).json({ message: 'Requête invalide' });
    }

    connection.query('SELECT id, login, pasword FROM User WHERE login = ?', [login], (err, results) => {
        if (err) {
            console.error('Erreur SQL :', err);
            return res.status(500).json({ message: 'Erreur serveur' });
        }
        else if (results.length === 0) {
            return res.status(401).json({ message: 'Identifiants invalides' });
        }

        const user = results[0];
        const match = bcrypt.compareSync(pasword, user.pasword);

        if (match) {
            res.status(202).json({ user: { id: user.id, login: user.login } });
        } else {
            res.status(401).json({ message: 'Identifiants invalides' });
        }
    });
});

app.listen(9000, () => {
    console.log('Serveur HTTP en écoute sur le port 9000');
});

// ── Serveur WebSocket ─────────────────────────────
const server = new WebSocketServer({ port: 9001 });
var clients = [];

server.on('connection', (socket) => {
    console.log('Clien connecte');
    clients.push(socket);
    
    // idSalon par défaut à 1
    const idSalonDefaut = 1;

    connection.query(
        'SELECT Message.text, User.login, Message.idSalon FROM Message INNER JOIN User ON Message.idUser = User.id WHERE idSalon = ? ORDER BY Message.id DESC LIMIT 100', 
        [idSalonDefaut], 
        (err, results) => {
            if (err) {
                console.error('Erreur historique SQL :', err);
            } else {
                const history = results.reverse();
                socket.send(JSON.stringify({ type: 'history', data: history }));
            }
        }
    );

    socket.on('message', (data) => {

        try { //pour éviter que le serveur s'arrête en cas de message jason mal formé
            const message = data.toString();
            console.log(`Reçu : ${message}`);
            
            const messageObject = JSON.parse(message);
            const { userId, text, idSalon } = messageObject;

            connection.query(
                'INSERT INTO Message (`idSalon`, `idUser`, `text`) VALUES (?, ?, ?)', 
                [idSalon, userId, text], 
                (err, results) => {
                    if (err) {
                        console.error('Erreur SQL :', err);
                        socket.send(JSON.stringify({ type: 'error', message: 'Erreur de sauvegarde.' }));
                        return;
                    }
                    
                    console.log('Message inséré, ID :', results.insertId);
                    
                    // Broadcast
                    const broadcastMessage = JSON.stringify({ 
                        message: text, 
                        idSalon: idSalon, 
                        userId: userId 
                    });
                    
                    clients.forEach(client => {
                        if (client.readyState === 1) { // 1 = OPEN
                            client.send(broadcastMessage);
                        }
                    });
                }
            );
        } catch (error) {
            console.error('Erreur au traitement du message :', error);
        }
    });

    socket.on('close', () => {
        console.log('Client déconnecté');
        const index = clients.indexOf(socket);
        if (index !== -1) clients.splice(index, 1);
    });

    socket.on('error', (err) => {
        console.error('Erreur Socket:', err);
    });
});
