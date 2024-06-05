const jwt = require("jsonwebtoken");
const verifyToken = (req, res, next) => {
    const token = req?.headers?.authorization.split(' ')[1];
    if (!token) {
        return res.status(401).send({ message: 'Unauthorized access' });
    }

    jwt.verify(token, process.env.TOKEN_SECRET, (err, decoded) => {
        if (err) {
            console.log(err);
            return res.status(401).send({ message: 'Unauthorized access' });
        }
        req.user = decoded;
        next();
    });
};
module.exports = verifyToken;
