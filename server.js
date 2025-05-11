const express = require('express');
const mysql = require('mysql');
const cors = require('cors');
const path = require('path');
const nodemailer = require('nodemailer');


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
        mp.team_id1,
        mp.team_id2,
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


// Get teams NOT already in a specific tournament
app.get('/api/teams-not-in-tournament', (req, res) => {
  const { tr_id } = req.query;

  if (!tr_id) {
    return res.status(400).json({ success: false, message: "Missing tournament ID" });
  }

  const sql = `
    SELECT team_id, team_name 
    FROM TEAM 
    WHERE team_id NOT IN (
      SELECT team_id 
      FROM TOURNAMENT_TEAM 
      WHERE tr_id = ?
    );
  `;

  db.query(sql, [tr_id], (err, result) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ success: false, message: "Query failed" });
    }

    res.json(result);
  });
});

// Add a team to a tournament (with check to prevent duplicates)
app.post('/api/tournament-team', (req, res) => {
  const { tr_id, team_id } = req.body;

  if (!tr_id || !team_id) {
    return res.status(400).json({ success: false, message: "Missing fields." });
  }

  const checkQuery = 'SELECT * FROM TOURNAMENT_TEAM WHERE tr_id = ? AND team_id = ?';
  db.query(checkQuery, [tr_id, team_id], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: "Database error." });
    if (results.length > 0) {
      return res.status(409).json({ success: false, message: "Team already added to tournament." });
    }

    const insertQuery = `
      INSERT INTO TOURNAMENT_TEAM (
        team_id, tr_id, team_group, match_played, won, draw, lost, goal_for, goal_against, goal_diff, points, group_position
      ) VALUES (?, ?, 'A', 0, 0, 0, 0, 0, 0, 0, 0, 0)
    `;

    db.query(insertQuery, [team_id, tr_id], (err2) => {
      if (err2) return res.status(500).json({ success: false, message: "Insert failed." });
      res.json({ success: true });
    });
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

app.get('/api/match-teams', (req, res) => {
  const { match_no } = req.query;
  if (!match_no) return res.status(400).json({ success: false, message: "Missing match number" });

  const sql = `
    SELECT team_id1 AS team1, team_id2 AS team2
    FROM MATCH_PLAYED
    WHERE match_no = ?
  `;
  db.query(sql, [match_no], (err, result) => {
    if (err) {
      console.error("Error fetching teams:", err);
      return res.status(500).json({ success: false, message: "DB error" });
    }
    if (result.length === 0) return res.json([]);
    res.json([result[0].team1, result[0].team2]);
  });
});

app.get('/api/team-players', (req, res) => {
  const { team_id } = req.query;
  if (!team_id) return res.status(400).json({ success: false, message: "Missing team ID" });

  const sql = `
    SELECT p.player_id, pr.name
    FROM PLAYER p
    JOIN PERSON pr ON pr.kfupm_id = p.player_id
    JOIN TEAM_PLAYER tp ON tp.player_id = p.player_id
    WHERE tp.team_id = ?
  `;
  db.query(sql, [team_id], (err, result) => {
    if (err) {
      console.error("Error fetching players:", err);
      return res.status(500).json({ success: false, message: "DB error" });
    }
    res.json(result);
  });
});

app.post('/api/assign-captain', (req, res) => {
  const { match_no, team_id, player_id } = req.body;

  if (!match_no || !team_id || !player_id) {
    return res.status(400).json({ success: false, message: "Missing data" });
  }

  const checkSql = `
    SELECT * FROM MATCH_CAPTAIN
    WHERE match_no = ? AND team_id = ?
  `;

  db.query(checkSql, [match_no, team_id], (checkErr, result) => {
    if (checkErr) {
      console.error("Error checking existing captain:", checkErr);
      return res.status(500).json({ success: false, message: "Database error during check" });
    }

    if (result.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Captain already assigned for this team in this match"
      });
    }

    const insertSql = `
      INSERT INTO MATCH_CAPTAIN (match_no, team_id, player_captain)
      VALUES (?, ?, ?)
    `;

    db.query(insertSql, [match_no, team_id, player_id], (insertErr) => {
      if (insertErr) {
        console.error("Captain assignment failed:", insertErr);
        return res.status(500).json({ success: false, message: "Database error" });
      }

      res.json({ success: true });
    });
  });
});

app.get('/api/match-list', (req, res) => {
  const sql = `
    SELECT 
      mp.match_no,
      t1.team_id AS team_id1,
      t1.team_name AS team_name1,
      t2.team_id AS team_id2,
      t2.team_name AS team_name2
    FROM MATCH_PLAYED mp
    JOIN TEAM t1 ON mp.team_id1 = t1.team_id
    JOIN TEAM t2 ON mp.team_id2 = t2.team_id
    ORDER BY mp.match_no;
  `;

  db.query(sql, (err, result) => {
    if (err) {
      console.error("Error fetching match list:", err);
      return res.status(500).json({ success: false, message: "Database error" });
    }
    res.json(result);
  });
});

app.get('/api/team-members-in-match', (req, res) => {
  const { match_no, team_id } = req.query;

  if (!match_no || !team_id) {
    return res.status(400).json({ success: false, message: "Missing match_no or team_id" });
  }

  const sql = `
    SELECT p.player_id, pr.name
    FROM TEAM_PLAYER tp
    JOIN PLAYER p ON tp.player_id = p.player_id
    JOIN PERSON pr ON p.player_id = pr.kfupm_id
    WHERE tp.team_id = ? AND tp.tr_id IN (
      SELECT tt.tr_id
      FROM TOURNAMENT_TEAM tt
      JOIN MATCH_PLAYED mp ON mp.team_id1 = tt.team_id OR mp.team_id2 = tt.team_id
      WHERE mp.match_no = ?
    );
  `;

  db.query(sql, [team_id, match_no], (err, result) => {
    if (err) {
      console.error("Error fetching team members in match:", err);
      return res.status(500).json({ success: false, message: "Query failed" });
    }
    res.json(result);
  });
});


app.get('/api/pending-players', (req, res) => {
  const sql = `
    SELECT 
      r.player_id,
      r.team_id,
      r.tr_id,
      p.name,
      p.date_of_birth,
      p.kfupm_id,
      t.team_name
    FROM REGISTRATION_REQUEST r
    JOIN PERSON p ON r.player_id = p.kfupm_id
    JOIN TEAM t ON r.team_id = t.team_id
    WHERE r.status = 'pending';
  `;

  db.query(sql, (err, result) => {
    if (err) {
      console.error("Error fetching pending players:", err);
      return res.status(500).json({ success: false, message: "Database error" });
    }
    res.json(result);
  });
});

// ✅ BACKEND FIXED ENDPOINT
app.post('/api/approve-player', (req, res) => {
  const { player_id, team_id, tr_id } = req.body;

  const defaultJersey = 0;
  const defaultPosition = 100; // make sure 100 exists in PLAYING_POSITION

  // Check if player exists in PLAYER table
  const checkPlayerQuery = 'SELECT * FROM PLAYER WHERE player_id = ?';

  db.query(checkPlayerQuery, [player_id], (checkErr, results) => {
    if (checkErr) {
      console.error("Error checking PLAYER existence:", checkErr);
      return res.status(500).json({ success: false, message: "Database error on check." });
    }

    const insertPlayer = `INSERT INTO PLAYER (player_id, jersey_no, position_to_play) VALUES (?, ?, ?)`;
    const insertTeamPlayer = `INSERT INTO TEAM_PLAYER (player_id, team_id, tr_id) VALUES (?, ?, ?)`;
    const updateRequest = `UPDATE REGISTRATION_REQUEST SET status = 'approved' WHERE player_id = ? AND team_id = ? AND tr_id = ?`;

    const addToTeamPlayer = () => {
      db.query(insertTeamPlayer, [player_id, team_id, tr_id], (err2) => {
        if (err2) {
          console.error("Failed to insert into TEAM_PLAYER:", err2);
          return res.status(500).json({ success: false, message: "Could not insert into TEAM_PLAYER." });
        }

        db.query(updateRequest, [player_id, team_id, tr_id], (err3) => {
          if (err3) {
            console.error("Failed to update REGISTRATION_REQUEST:", err3);
            return res.status(500).json({ success: false, message: "Could not update request status." });
          }

          res.json({ success: true });
        });
      });
    };

    if (results.length === 0) {
      // Not in PLAYER table: insert first
      db.query(insertPlayer, [player_id, defaultJersey, defaultPosition], (err1) => {
        if (err1) {
          console.error("Failed to insert into PLAYER:", err1);
          return res.status(500).json({ success: false, message: "Insert into PLAYER failed." });
        }
        addToTeamPlayer();
      });
    } else {
      // Already in PLAYER table: just add to TEAM_PLAYER
      addToTeamPlayer();
    }
  });
});


app.post('/api/reject-player', (req, res) => {
  const { player_id, team_id, tr_id } = req.body;
  const updateStatus = `
    UPDATE REGISTRATION_REQUEST SET status = 'rejected'
    WHERE player_id = ? AND team_id = ? AND tr_id = ?
  `;

  db.query(updateStatus, [player_id, team_id, tr_id], (err) => {
    if (err) return res.status(500).json({ error: 'Update failed' });
    res.json({ success: true });
  });
});

//view players with red cards
app.get('/api/redCards', (req, res) => {
    const sql = `
        SELECT
            per.name AS player_name,
            tm.team_name,
            COUNT(*) AS red_card_count
        FROM PENALTY_GK pg
                 JOIN PLAYER p ON pg.player_gk = p.player_id
                 JOIN PERSON per ON p.player_id = per.kfupm_id
                 JOIN TEAM tm ON pg.team_id = tm.team_id
        GROUP BY pg.player_gk, per.name, tm.team_name
        ORDER BY red_card_count DESC;
    `;

    db.query(sql, (err, result) => {
        if (err) {
            console.error("Red cards query error:", err.sqlMessage);
            return res.status(500).json({ success: false, message: "Database error.", error: err.sqlMessage });
        }
        res.json(result);
    });
});

// view players of each team
app.get('/api/teamMembers', (req, res) => {
    const teamId = req.query.team_id;

    if (!teamId) {
        return res.status(400).json({ success: false, message: "Missing team_id" });
    }

    const sql = `
        SELECT
            pr.name,
            p.jersey_no,
            pos.position_desc AS role,
            t.tr_name AS tournament
        FROM TEAM_PLAYER tp
                 JOIN PLAYER p ON tp.player_id = p.player_id
                 JOIN PERSON pr ON p.player_id = pr.kfupm_id
                 JOIN PLAYING_POSITION pos ON p.position_to_play = pos.position_id
                 JOIN TOURNAMENT t ON tp.tr_id = t.tr_id
        WHERE tp.team_id = ?;
    `;

    db.query(sql, [teamId], (err, result) => {
        if (err) {
            console.error("Team members query error:", err.sqlMessage);
            return res.status(500).json({ success: false, message: "Database error", error: err.sqlMessage });
        }
        res.json(result);
    });
});

//admin login authentication
app.post('/api/admin-login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: "Username and password are required." });
    }

    const sql = `SELECT * FROM ADMIN WHERE admin_username = ? AND admin_password = ?`;

    db.query(sql, [username, password], (err, result) => {
        if (err) {
            console.error("Admin login query error:", err);
            return res.status(500).json({ success: false, message: "Database error." });
        }

        if (result.length > 0) {
            res.json({ success: true });
        } else {
            res.status(401).json({ success: false, message: "Invalid credentials." });
        }
    });
});

// Tournament basic info
app.get('/api/tournament/:id', (req, res) => {
  const { id } = req.params;

  const sql = `
    SELECT tr_id, tr_name, start_date, end_date
    FROM TOURNAMENT
    WHERE tr_id = ?
  `;

  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error("Error fetching tournament:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (result.length === 0) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    res.json(result[0]);
  });
});

// Participating teams
app.get('/api/tournament-details/:tr_id', (req, res) => {
  const { tr_id } = req.params;

  const sql = `
    SELECT 
      t.team_id,
      t.team_name,
      tt.team_group,
      tt.match_played,
      tt.won,
      tt.draw,
      tt.lost,
      tt.goal_for,
      tt.goal_against,
      tt.points
    FROM TOURNAMENT_TEAM tt
    JOIN TEAM t ON tt.team_id = t.team_id
    WHERE tt.tr_id = ?
  `;

  db.query(sql, [tr_id], (err, results) => {
    if (err) {
      console.error("Error loading tournament details:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results);
  });
});



app.get('/api/match-results-with-scorers', (req, res) => {
  const sql = `
    SELECT 
      mp.match_no,
      t1.team_name AS team1,
      (
        SELECT GROUP_CONCAT(DISTINCT per.name ORDER BY per.name SEPARATOR ', ')
        FROM GOAL_DETAILS gd
        JOIN PLAYER p ON p.player_id = gd.player_id
        JOIN PERSON per ON per.kfupm_id = p.player_id
        WHERE gd.match_no = mp.match_no AND gd.team_id = mp.team_id1
      ) AS team1_scorers,
      (
        SELECT COUNT(*)
        FROM GOAL_DETAILS gd
        WHERE gd.match_no = mp.match_no AND gd.team_id = mp.team_id1
      ) AS team1_goals,

      t2.team_name AS team2,
      (
        SELECT GROUP_CONCAT(DISTINCT per.name ORDER BY per.name SEPARATOR ', ')
        FROM GOAL_DETAILS gd
        JOIN PLAYER p ON p.player_id = gd.player_id
        JOIN PERSON per ON per.kfupm_id = p.player_id
        WHERE gd.match_no = mp.match_no AND gd.team_id = mp.team_id2
      ) AS team2_scorers,
      (
        SELECT COUNT(*)
        FROM GOAL_DETAILS gd
        WHERE gd.match_no = mp.match_no AND gd.team_id = mp.team_id2
      ) AS team2_goals,

      CONCAT(
        (SELECT COUNT(*) FROM GOAL_DETAILS gd
         WHERE gd.match_no = mp.match_no AND gd.team_id = mp.team_id1),
        '-',
        (SELECT COUNT(*) FROM GOAL_DETAILS gd
         WHERE gd.match_no = mp.match_no AND gd.team_id = mp.team_id2)
      ) AS final_score,

      CASE 
        WHEN
          (SELECT COUNT(*) FROM GOAL_DETAILS gd
           WHERE gd.match_no = mp.match_no AND gd.team_id = mp.team_id1) >
          (SELECT COUNT(*) FROM GOAL_DETAILS gd
           WHERE gd.match_no = mp.match_no AND gd.team_id = mp.team_id2)
          THEN t1.team_name
        WHEN
          (SELECT COUNT(*) FROM GOAL_DETAILS gd
           WHERE gd.match_no = mp.match_no AND gd.team_id = mp.team_id1) <
          (SELECT COUNT(*) FROM GOAL_DETAILS gd
           WHERE gd.match_no = mp.match_no AND gd.team_id = mp.team_id2)
          THEN t2.team_name
        ELSE 'Draw'
      END AS result

    FROM MATCH_PLAYED mp
    JOIN TEAM t1 ON mp.team_id1 = t1.team_id
    JOIN TEAM t2 ON mp.team_id2 = t2.team_id
    ORDER BY mp.match_no;
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Error in match results with scorers:", err);
      return res.status(500).json({ error: "Failed to load match results" });
    }
    res.json(results);
  });
});


app.get('/api/match-venues', (req, res) => {
  const sql = `
    SELECT 
      mp.match_no, mp.play_date, 
      v.venue_name, v.venue_capacity
    FROM MATCH_PLAYED mp
    JOIN VENUE v ON mp.venue_id = v.venue_id
    ORDER BY mp.play_date;
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching match venues:", err);
      return res.status(500).json({ error: "Failed to load venues" });
    }

    res.json(results);
  });
});


app.get('/api/match-referees', (req, res) => {
  const sql = `
    SELECT 
      mp.match_no,
      mp.play_date,
      per.name,
      CASE 
        WHEN ms.support_type = 'RF' THEN 'Referee'
        WHEN ms.support_type = 'AR' THEN 'Assistant Referee'
        ELSE ms.support_type
      END AS role
    FROM MATCH_PLAYED mp
    JOIN MATCH_SUPPORT ms ON mp.match_no = ms.match_no
    JOIN PERSON per ON ms.support_id = per.kfupm_id
    ORDER BY mp.match_no, ms.support_type;
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Error loading referees:", err);
      return res.status(500).json({ error: "Failed to load referee data" });
    }

    res.json(results);
  });
});


app.get('/api/players-in-match-with-email', (req, res) => {
    const { match_no } = req.query;
    if (!match_no) {
        return res.status(400).json({ success: false, message: "Missing match_no" });
    }
    const sql = `
    SELECT DISTINCT pr.name, pr.email
    FROM MATCH_PLAYED mp
    JOIN TEAM_PLAYER tp ON tp.team_id IN (mp.team_id1, mp.team_id2)
    JOIN PERSON pr ON pr.kfupm_id = tp.player_id
    WHERE mp.match_no = ?;
  `;

    db.query(sql, [match_no], (err, result) => {
        if (err) {
            console.error("Error fetching players with email:", err);
            return res.status(500).json({ success: false, message: "Database error" });
        }
        res.json(result);
    });
});

app.post('/api/send-reminder-emails', async (req, res) => {
    const { match_no, players } = req.body;

    if (!match_no || !players || !Array.isArray(players)) {
        return res.status(400).json({ success: false, message: "Missing or invalid data." });
    }

    const matchInfoSql = `
        SELECT t1.team_name AS team1, t2.team_name AS team2
        FROM MATCH_PLAYED mp
                 JOIN TEAM t1 ON mp.team_id1 = t1.team_id
                 JOIN TEAM t2 ON mp.team_id2 = t2.team_id
        WHERE mp.match_no = ?
    `;

    db.query(matchInfoSql, [match_no], async (matchErr, matchResult) => {
        if (matchErr) {
            console.error("Match lookup error:", matchErr);
            return res.status(500).json({ success: false, message: "Failed to retrieve match info." });
        }

        if (matchResult.length === 0) {
            return res.status(404).json({ success: false, message: "Match not found." });
        }

        const { team1, team2 } = matchResult[0];

        // Email setup
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: 'safsalem123456@gmail.com',
                pass: 'atmr qfea lpog ccem'
            }
        });

        const subject = `Reminder: Match #${match_no} – ${team1} vs ${team2}`;
        const body = (name) => `
Dear ${name},

This is a reminder that you have a scheduled match:

Match #${match_no}: ${team1} vs ${team2}

Please arrive on time and be prepared. Good luck!

– Tournament Admin Team
`;

        try {
            const emailPromises = players.map(player => {
                const mailOptions = {
                    from: 'safsalem123456@gmail.com',
                    to: player.email,
                    subject: subject,
                    text: body(player.name)
                };
                return transporter.sendMail(mailOptions);
            });

            await Promise.all(emailPromises);
            res.json({ success: true, message: "Emails sent successfully." });
        } catch (error) {
            console.error("Email sending error:", error);
            res.status(500).json({ success: false, message: "Failed to send emails." });
        }
    });
});

// Backend Update (Node.js + MySQL)
app.get('/api/pending-matches', (req, res) => {
  const sql = `
    SELECT 
      mp.match_no,
      t1.team_name AS team1,
      t1.team_id AS team1_id,
      t2.team_name AS team2,
      t2.team_id AS team2_id
    FROM MATCH_PLAYED mp
    JOIN TEAM t1 ON mp.team_id1 = t1.team_id
    JOIN TEAM t2 ON mp.team_id2 = t2.team_id
    WHERE mp.match_no NOT IN (SELECT DISTINCT match_no FROM match_details)
    ORDER BY mp.match_no;
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("🔴 SQL Error in /api/pending-matches:", err.sqlMessage);
      return res.status(500).json({ error: "Failed to load matches" });
    }

    res.json(results);
  });
});


app.post('/api/enter-result', (req, res) => {
  const { match_no, team1_id, team1_goals, team2_id, team2_goals } = req.body;

  const insertResults = `
    INSERT INTO match_details (match_no, team_id, win_lose, decided_by, goal_score, penalty_score, player_gk)
    VALUES (?, ?, ?, 'N', ?, 0, 1001), (?, ?, ?, 'N', ?, 0, 1001)
  `;

  const team1_result = team1_goals > team2_goals ? 'W' : team1_goals < team2_goals ? 'L' : 'D';
  const team2_result = team2_goals > team1_goals ? 'W' : team2_goals < team1_goals ? 'L' : 'D';

  db.query(insertResults, [match_no, team1_id, team1_result, team1_goals, match_no, team2_id, team2_result, team2_goals], (err) => {
    if (err) {
      console.error('Error inserting match result:', err);
      return res.json({ success: false });
    }

    res.json({ success: true });
  });
});

app.get('/api/upcoming-matches', (req, res) => {
  const sql = `
    SELECT 
      mp.match_no,
      t1.team_name AS team1,
      t2.team_name AS team2,
      mp.play_date
    FROM MATCH_PLAYED mp
    JOIN TEAM t1 ON mp.team_id1 = t1.team_id
    JOIN TEAM t2 ON mp.team_id2 = t2.team_id
    WHERE mp.play_date > CURDATE()
    ORDER BY mp.play_date ASC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching upcoming matches:", err);
      return res.status(500).json({ error: "Failed to load upcoming matches" });
    }
    res.json(results);
  });
});

// View players with yellow cards
app.get('/api/yellowCards', (req, res) => {
  const sql = `
    SELECT
      per.name AS player_name,
      tm.team_name,
      COUNT(*) AS yellow_card_count
    FROM PLAYER_BOOKED pb
    JOIN PLAYER p ON pb.player_id = p.player_id
    JOIN PERSON per ON p.player_id = per.kfupm_id
    JOIN TEAM tm ON pb.team_id = tm.team_id
    WHERE pb.sent_off = 'N'
    GROUP BY pb.player_id, per.name, tm.team_name
    ORDER BY yellow_card_count DESC;
  `;

  db.query(sql, (err, result) => {
    if (err) {
      console.error("Yellow cards query error:", err.sqlMessage);
      return res.status(500).json({ success: false, message: "Database error.", error: err.sqlMessage });
    }
    res.json(result);
  });
});


app.get('/api/tournaments', (req, res) => {
  const sql = `SELECT tr_id, tr_name FROM TOURNAMENT ORDER BY tr_name`;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching tournaments:", err);
      return res.status(500).json({ success: false, message: "Database error." });
    }
    res.json(results);
  });
});

app.get('/api/topTeams/:tr_id', (req, res) => {
  const { tr_id } = req.params;
  const sql = `
    SELECT 
      t.team_name,
      tt.points
    FROM TOURNAMENT_TEAM tt
    JOIN TEAM t ON t.team_id = tt.team_id
    WHERE tt.tr_id = ?
    ORDER BY tt.points DESC
    LIMIT 3;
  `;

  db.query(sql, [tr_id], (err, results) => {
    if (err) {
      console.error("Error fetching top teams:", err);
      return res.status(500).json({ success: false, message: "Database error." });
    }
    res.json(results);
  });
});

app.get('/api/refereeMatches', (req, res) => {
  const sql = `
    SELECT per.name, COUNT(*) AS match_count
    FROM MATCH_SUPPORT ms
    JOIN PERSON per ON ms.support_id = per.kfupm_id
    WHERE ms.support_type = 'RF'
    GROUP BY per.name
    ORDER BY match_count DESC;
  `;

  db.query(sql, (err, result) => {
    if (err) {
      console.error("Referee count error:", err.sqlMessage);
      return res.status(500).json({ error: "Failed to load referee data" });
    }
    res.json(result);
  });
});


app.get('/api/goals-by-team/:tr_id', (req, res) => {
  const tr_id = req.params.tr_id;

  const sql = `
    SELECT 
      t.team_name, 
      COALESCE(SUM(g.goal_score), 0) AS total_goals
    FROM TOURNAMENT_TEAM tt
    JOIN TEAM t ON tt.team_id = t.team_id
    LEFT JOIN match_details g ON g.team_id = tt.team_id
    WHERE tt.tr_id = ?
    GROUP BY t.team_name
    ORDER BY total_goals DESC;
  `;

  db.query(sql, [tr_id], (err, results) => {
    if (err) {
      console.error("Goal stats error:", err.sqlMessage);
      return res.status(500).json({ error: "Database error." });
    }
    res.json(results);
  });
});


app.get('/api/tournaments', (req, res) => {
  db.query('SELECT tr_id, tr_name FROM TOURNAMENT', (err, results) => {
    if (err) {
      console.error("Tournaments fetch error:", err.sqlMessage);
      return res.status(500).json({ error: "Could not fetch tournaments." });
    }
    res.json(results);
  });
});

app.get('/api/players-without-goals', (req, res) => {
  const { tr_id } = req.query;

  if (!tr_id) {
    return res.status(400).json({ success: false, message: "Missing tournament ID" });
  }

  const sql = `
    SELECT 
      pr.name AS player_name,
      tm.team_name
    FROM TEAM_PLAYER tp
    JOIN PLAYER p ON tp.player_id = p.player_id
    JOIN PERSON pr ON p.player_id = pr.kfupm_id
    JOIN TEAM tm ON tp.team_id = tm.team_id
    WHERE tp.tr_id = ?
      AND p.player_id NOT IN (
        SELECT DISTINCT g.player_id
        FROM GOAL_DETAILS g
        JOIN TEAM_PLAYER tp2 ON g.player_id = tp2.player_id
        WHERE tp2.tr_id = ?
      )
    ORDER BY pr.name;
  `;

  db.query(sql, [tr_id, tr_id], (err, result) => {
    if (err) {
      console.error("Players without goals query error:", err.sqlMessage);
      return res.status(500).json({ error: "Database error." });
    }
    res.json(result);
  });
});


app.get('/api/matches-played', (req, res) => {
  const sql = `
    SELECT 
      per.name AS player_name,
      tm.team_name,
      COUNT(DISTINCT mp.match_no) AS match_count
    FROM PLAYER_IN_OUT pio
    JOIN PLAYER p ON p.player_id = pio.player_id
    JOIN PERSON per ON per.kfupm_id = p.player_id
    JOIN TEAM_PLAYER tp ON tp.player_id = p.player_id
    JOIN TEAM tm ON tp.team_id = tm.team_id
    JOIN MATCH_PLAYED mp ON pio.match_no = mp.match_no
    GROUP BY p.player_id, per.name, tm.team_name
    ORDER BY match_count DESC;
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Matches played query error:", err.sqlMessage);
      return res.status(500).json({ error: "Failed to fetch match data." });
    }
    res.json(results);
  });
});

app.delete('/api/tournaments/:tr_id', (req, res) => {
  const tr_id = req.params.tr_id;

  const deleteQuery = 'DELETE FROM TOURNAMENT WHERE tr_id = ?';

  db.query(deleteQuery, [tr_id], (err, result) => {
    if (err) {
      console.error("❌ Tournament delete error:", err.sqlMessage);
      return res.status(500).json({ success: false, message: "Database error." });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Tournament not found." });
    }

    res.json({ success: true, message: "Tournament deleted successfully." });
  });
});


app.get('/api/unassigned-people', (req, res) => {
  const sql = `
    SELECT p.kfupm_id AS player_id, p.name, p.date_of_birth
    FROM PERSON p
    WHERE p.kfupm_id NOT IN (SELECT player_id FROM PLAYER);
  `;

  db.query(sql, (err, result) => {
    if (err) {
      console.error("Error fetching unassigned people:", err);
      return res.status(500).json({ success: false, message: "Database error" });
    }
    res.json(result);
  });
});

app.post('/api/approve-person-to-team', (req, res) => {
  const { player_id, team_id, tr_id } = req.body;

  const jersey_no = 0;
  const position_to_play = 100; // Make sure ID 100 exists in PLAYING_POSITION

  const insertPlayerSQL = `
    INSERT INTO PLAYER (player_id, jersey_no, position_to_play)
    VALUES (?, ?, ?);
  `;

  const insertTeamPlayerSQL = `
    INSERT INTO TEAM_PLAYER (player_id, team_id, tr_id)
    VALUES (?, ?, ?);
  `;

  db.query(insertPlayerSQL, [player_id, jersey_no, position_to_play], (err1) => {
    if (err1) {
      console.error("Insert into PLAYER failed:", err1.sqlMessage);
      return res.status(500).json({ success: false, message: "Could not insert into PLAYER." });
    }

    db.query(insertTeamPlayerSQL, [player_id, team_id, tr_id], (err2) => {
      if (err2) {
        console.error("Insert into TEAM_PLAYER failed:", err2.sqlMessage);
        return res.status(500).json({ success: false, message: "Could not insert into TEAM_PLAYER." });
      }

      res.json({ success: true });
    });
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
