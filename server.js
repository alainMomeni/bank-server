
require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const { validateHmacSignature } = require('./middlewares/gabValidator');

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

app.get('/', (req, res) => {
    res.send('GAB Notification Demo API');
});

// Route pour recevoir les notifications GAB, maintenant sécurisée
app.post('/api/gab-notifications', validateHmacSignature, async (req, res) => {
    const {
        User,
        TransactionDate,
        TransactionAmount,
        TransactionNarration,
        TransactionReference,
        TransactionDRCRIndicator,
    } = req.body;

    try {
        const insertQuery = `
            INSERT INTO gab_notifications (
                user_name,
                transaction_date,
                transaction_amount,
                transaction_narration,
                transaction_reference,
                transaction_drcr_indicator,
                status
            ) VALUES ($1, TO_TIMESTAMP($2, 'YYYYMMDDHH24MISS'), $3, $4, $5, $6, 'pending')
            RETURNING id;
        `;
        
        const values = [
            User,
            TransactionDate,
            TransactionAmount,
            TransactionNarration,
            TransactionReference,
            TransactionDRCRIndicator
        ];
        
        await pool.query(insertQuery, values);
        res.status(200).json({ Result: "Success" });
        
    } catch (err) {
        if (err.code === '23505') {
            return res.status(200).json({ Result: "Repeat" });
        }
        
        console.error("Erreur lors de l'enregistrement:", err);
        res.status(500).json({ Result: "Failure" });
    }
});

// Route pour récupérer toutes les notifications
app.get('/api/gab-notifications', async (req, res) => {
    try {
        const query = `
            SELECT 
                id, user_name, transaction_date, transaction_amount, transaction_narration,
                transaction_reference, transaction_drcr_indicator, received_at, status
            FROM gab_notifications
            ORDER BY transaction_date DESC, received_at DESC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Erreur:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Route pour mettre à jour le statut d'une notification
app.patch('/api/gab-notifications/:id', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['pending', 'processed'].includes(status)) {
        return res.status(400).json({ error: "Statut invalide." });
    }

    try {
        const updateQuery = `
            UPDATE gab_notifications SET status = $1 WHERE id = $2 RETURNING *;
        `;
        const result = await pool.query(updateQuery, [status, id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Notification non trouvée.' });
        }
        
        res.status(200).json(result.rows[0]);
    } catch(err) {
        console.error('Erreur lors de la mise à jour:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.listen(port, () => {
    console.log(`Serveur démarré sur http://localhost:${port}`);
});