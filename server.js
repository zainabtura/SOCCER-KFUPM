const express = require('express');
const mysql = require('mysql');
const cors = require('cors');
const path = require('path');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "SOCCER")));


// Allow JSON parsing
app.use(express.json());


// MySQL connection
const db = mysql.createConnection({
    host: 'database-1.cjaqmykcmj4t.eu-north-1.rds.amazonaws.com',
    user: 'admin',
    password: 'database123*',
    database: 'mydb'
});

db.connect(err => {
    if (err) {
        console.error('Error connecting to database:', err);
        return;
    }
    console.log('Connected to MySQL RDS database');
});

// Matches route
app.get('/api/matches', (req, res) => {
    const sql = `
    SELECT 
      mp.match_no,
      t1.team_name AS team1,
      t2.team_name AS team2,
      md.goal_score,
      md.penalty_score,
      md.win_lose
    FROM MATCH_PLAYED mp
    JOIN TEAM t1 ON mp.team_id1 = t1.team_id
    JOIN TEAM t2 ON mp.team_id2 = t2.team_id
    JOIN match_details md ON mp.match_no = md.match_no;
  `;
    db.query(sql, (err, result) => {
        if (err) return res.status(500).send(err);
        res.json(result);
    });
});

// Teams route
app.get('/api/teams', (req, res) => {
    db.query('SELECT * FROM TEAM;', (err, result) => {
        if (err) return res.status(500).send(err);
        res.json(result);
    });
});

// Players route
app.get('/api/players', (req, res) => {
    const sql = `
    SELECT 
      p.player_id,
      p.jersey_no,
      p.position_to_play,
      pos.position_desc
    FROM PLAYER p
    JOIN PLAYING_POSITION pos ON p.position_to_play = pos.position_id;
  `;
    db.query(sql, (err, result) => {
        if (err) return res.status(500).send(err);
        res.json(result);
    });
});

// Bookings route
app.get('/api/bookings', (req, res) => {
    const sql = `
    SELECT 
      pb.match_no,
      pb.player_id,
      pb.booking_time,
      pb.sent_off,
      pb.play_schedule,
      pb.play_half
    FROM PLAYER_BOOKED pb;
  `;
    db.query(sql, (err, result) => {
        if (err) return res.status(500).send(err);
        res.json(result);
    });
});

// Goals route
app.get('/api/goals', (req, res) => {
    const sql = `
    SELECT 
      goal_id,
      match_no,
      player_id,
      goal_time,
      goal_type
    FROM GOAL_DETAILS;
  `;
    db.query(sql, (err, result) => {
        if (err) return res.status(500).send(err);
        res.json(result);
    });
});

// Venues route
app.get('/api/venues', (req, res) => {
    db.query('SELECT * FROM VENUE;', (err, result) => {
        if (err) return res.status(500).send(err);
        res.json(result);
    });
});

// Players in match
app.get('/api/players-in-match', (req, res) => {
    const sql = `
    SELECT 
      match_no,
      player_id,
      in_out,
      time_in_out
    FROM PLAYER_IN_OUT;
  `;
    db.query(sql, (err, result) => {
        if (err) return res.status(500).send(err);
        res.json(result);
    });
});

// Tournaments route
app.get('/api/tournaments', (req, res) => {
  db.query('SELECT * FROM TOURNAMENT;', (err, result) => {
    if (err) return res.status(500).send(err);
    res.json(result);
  });
});

// Tournament teams
app.get('/api/tournament-teams', (req, res) => {
    const sql = `
    SELECT 
      tt.tr_id,
      t.team_name,
      tt.match_played,
      tt.won,
      tt.lost,
      tt.draw
    FROM TOURNAMENT_TEAM tt
    JOIN TEAM t ON tt.team_id = t.team_id;
  `;
    db.query(sql, (err, result) => {
        if (err) return res.status(500).send(err);
        res.json(result);
    });
});


app.post('/api/tournaments', (req, res) => {
  const { tr_id, tr_name, start_date, end_date } = req.body;

  if (!tr_id || !tr_name || !start_date || !end_date) {
    return res.status(400).json({ success: false, message: "All fields are required." });
  }

  const parsedId = parseInt(tr_id);
  const checkQuery = 'SELECT * FROM TOURNAMENT WHERE tr_id = ? OR tr_name = ?';

  db.query(checkQuery, [parsedId, tr_name], (err, results) => {
    if (err) {
      console.error("Check Query Error:", err);
      return res.status(500).json({ success: false, message: "Database error during check." });
    }

    if (results.length > 0) {
      return res.status(409).json({ success: false, message: "Tournament ID or name already exists." });
    }

    const insertQuery = 'INSERT INTO TOURNAMENT (tr_id, tr_name, start_date, end_date) VALUES (?, ?, ?, ?)';

    db.query(insertQuery, [parsedId, tr_name, start_date, end_date], (err2) => {
      if (err2) {
        console.error("Insert Query Error:", err2);
        return res.status(500).json({ success: false, message: "Insert failed." });
      }

      console.log("Tournament inserted successfully.");
      return res.json({ success: true });
    });
  });
});

app.get('/api/matches-by-tournament', (req, res) => {
  const tournamentId = req.query.tr_id;

  if (!tournamentId) {
    return res.status(400).json({ success: false, message: "Missing tournament ID" });
  }

  const sql = `
  SELECT 
    mp.match_no,
    t1.team_name AS team1,
    t2.team_name AS team2,
    mp.goal_score,
    mp.play_date AS match_date
  FROM MATCH_PLAYED mp
  JOIN TEAM t1 ON mp.team_id1 = t1.team_id
  JOIN TEAM t2 ON mp.team_id2 = t2.team_id
  JOIN TOURNAMENT_TEAM tt1 ON mp.team_id1 = tt1.team_id
  JOIN TOURNAMENT_TEAM tt2 ON mp.team_id2 = tt2.team_id
  WHERE tt1.tr_id = ?
    AND tt2.tr_id = tt1.tr_id;
`;

  db.query(sql, [tournamentId], (err, result) => {
    if (err) {
      console.error("Error fetching matches:", err);
      return res.status(500).json({ success: false, message: "Database error" });
    }

    res.json(result);
  });
});


// retrieve top scorers by tournament
app.get('/api/topScorersByTournament', (req, res) => {
    const sql = `
        SELECT
            t.tr_name AS tournament_name,
            pr.name AS player_name,
            tm.team_name,
            COUNT(g.goal_id) AS total_goals
        FROM GOAL_DETAILS g
                 JOIN PLAYER p ON g.player_id = p.player_id
                 JOIN PERSON pr ON p.player_id = pr.kfupm_id
                 JOIN TEAM_PLAYER tp ON p.player_id = tp.player_id
                 JOIN TEAM tm ON tp.team_id = tm.team_id
                 JOIN TOURNAMENT t ON tp.tr_id = t.tr_id
        GROUP BY t.tr_id, pr.name, tm.team_name, p.player_id
        ORDER BY t.tr_id, total_goals DESC;
    `;

    db.query(sql, (err, result) => {
        if (err) {
            console.error("Top scorers query error:", err);
            return res.status(500).json({ success: false, message: "Database error." });
        }
        res.json(result);
    });
});

// use welcome.html as the default page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'SOCCER', 'welcome.html'));
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

module.exports = app;
