const express = require('express');
const bodyParser = require('body-parser');
const LoginContract = require('./login_contract.js');
const jwt = require('jsonwebtoken');
const cuid = require('cuid');
const cors = require('cors');

console.log("starting...");

const loginContract = LoginContract.at(process.env.LOGIN_CONTRACT_ADDRESS || '0xf7b06365e9012592c8c136b71c7a2475c7a94d71');

// console.log("loginContract = ", loginContract);
console.log("got logincontract");
// LoginAttempt is the name of the event that signals logins in the 

// Login contract. This is specified in the login.sol file.
const loginAttempt = loginContract.LoginAttempt();

console.log("loginAttempt successful");

const challenges = {};
const successfulLogins = {};

console.log("watching login attempt");

loginAttempt.watch((error, event) => {
    console.log('login attempt');
    if(error) {
        console.log(error);
        return;
    }

    // console.log(event);

    const sender = event.args.sender.toLowerCase();

    // If the challenge sent through Ethereum matches the one we generated,
    // mark the login attempt as valid, otherwise ignore it.
    console.log('challenges sender = ', challenges[sender]);
    console.log('event.args.challenge = ', event.args.challenge);
    
    if(challenges[sender] === event.args.challenge) {
        successfulLogins[sender] = true;
        console.log("successful");
    }
});

// From here on its just express.js
const secret = process.env.JWT_SECRET || "my super secret passcode";

const app = express();
// WARNING: CHANGE IN PRODUCTION
// app.use(cors({
//     origin: 'http://localhost:3000'
// }))
app.use(cors());
// app.use(cor options('*', cors());

app.use(bodyParser.json({ type: () => true }));

function validateJwt(req, res, next) {
    try {
        req.jwt = jwt.verify(req.body.jwt, secret, { 
            algorithms: ['HS256'] 
        });
        next();
    } catch(e) {
        res.sendStatus(401); //Unauthorized
    }
}

app.post('/login', (req, res) => {
    // All Ethereum addresses are 42 characters long
    if(!req.body.address || req.body.address.length !== 42) {
        res.sendStatus(400);
        return;
    }
    
    // console.log('app.post req = ', req);
    console.log("login request");

    req.body.address = req.body.address.toLowerCase();

    const challenge = cuid();
    challenges[req.body.address] = challenge;

    // console.log("req = ", req);

    const token = jwt.sign({ 
        address: req.body.address, 
        access: 'finishLogin'
    }, secret);

    res.json({
        challenge: challenge,
        jwt: token
    });

    // console.log("res = ", res);

});

app.post('/finishLogin', validateJwt, (req, res) => {
    // console.log("finish login...");
    if(!req.jwt || !req.jwt.address || req.jwt.access !== 'finishLogin') {
        res.sendStatus(400);
        console.log('req.jwt = ', req.jwt);
        console.log('req.jwt.address = ', req.jwt.address);
        console.log('req.jwt.access = ', req.jwt.access);
        
        return;
    }

    if(successfulLogins[req.jwt.address]) {
        console.log('req.jwt = ', req.jwt);
        console.log('req.jwt.address = ', req.jwt.address);
        console.log('req.jwt.access = ', req.jwt.access);
        delete successfulLogins[req.jwt.address];
        delete challenges[req.jwt.address];

        const token = jwt.sign({ 
            address: req.jwt.address, 
            access: 'full'
        }, secret);
        console.log("successful login");
        res.json({
            jwt: token,
            address: req.jwt.address
        });
    } else {
        // HTTP Accepted (not completed)
        res.sendStatus(202);
    }
});



app.post('/apiTest', validateJwt, (req, res) => {
    if(req.jwt.access !== 'full') {
        res.sendStatus(401); //Unauthorized
        return;
    }

    res.json({
        message: 'It works!'
    });
});

app.listen(process.env.PORT || 3000);
