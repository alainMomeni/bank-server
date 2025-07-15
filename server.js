require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

app.get('/', (req, res) => {
    res.send('GAB Notification Demo API');
});

// Route pour recevoir les notifications GAB
app.post('/api/gab-notifications', async (req, res) => {
    console.log("Notification GAB reçue:", req.body);
    
    const {
        User,
        Password,
        TransactionDate,
        TransactionAmount,
        TransactionNarration,
        TransactionReference,
        TransactionDRCRIndicator,
        Hash
    } = req.body;

    try {
        const insertQuery = `
            INSERT INTO gab_notifications (
                user_name,
                password,
                transaction_date,
                transaction_amount,
                transaction_narration,
                transaction_reference,
                transaction_drcr_indicator,
                hash_val,
                status
            ) VALUES ($1, $2, TO_TIMESTAMP($3, 'YYYYMMDDHH24MISS'), $4, $5, $6, $7, $8, 'pending')
            RETURNING id;
        `;
        
        const values = [
            User,
            Password,
            TransactionDate,
            TransactionAmount,
            TransactionNarration,
            TransactionReference,
            TransactionDRCRIndicator,
            Hash
        ];
        
        const result = await pool.query(insertQuery, values);
        console.log(`Notification enregistrée avec l'ID: ${result.rows[0].id}`);
        
        res.status(200).json({ Result: "Success" });
        
    } catch (err) {
        console.error("Erreur lors de l'enregistrement:", err);
        
        if (err.code === '23505') {
            console.log(`Transaction en doublon: ${TransactionReference}`);
            return res.status(200).json({ Result: "Repeat" });
        }
        
        res.status(500).json({ Result: "Failure" });
    }
});

// Route pour récupérer toutes les notifications (avec le statut)
app.get('/api/gab-notifications', async (req, res) => {
    try {
        const query = `
            SELECT 
                id,
                user_name,
                transaction_date,
                transaction_amount,
                transaction_narration,
                transaction_reference,
                transaction_drcr_indicator,
                received_at,
                status
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
        return res.status(400).json({ error: "Statut invalide. Le statut doit être 'pending' ou 'processed'." });
    }

    try {
        const updateQuery = `
            UPDATE gab_notifications
            SET status = $1
            WHERE id = $2
            RETURNING *;
        `;
        const result = await pool.query(updateQuery, [status, id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Notification non trouvée.' });
        }
        
        console.log(`Statut de la notification ${id} mis à jour à '${status}'`);
        res.status(200).json(result.rows[0]);

    } catch(err) {
        console.error('Erreur lors de la mise à jour:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});


app.listen(port, () => {
    console.log(`Serveur démarré sur http://localhost:${port}`);
});