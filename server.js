const express = require('express');
const mysql = require('mysql');
const cors = require('cors');
const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
// Allow JSON parsing
app.use(express.json());
// Serve static files from the build directory
app.use(express.static(path.join(__dirname, "build")));

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

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});

module.exports = app;
