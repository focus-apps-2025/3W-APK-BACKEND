const express = require('express');
require('dotenv').config();
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');

const app = express();

// Security: Disable express fingerprinting
app.disable('x-powered-by');

// Security: Set security headers
app.use(helmet());

const isProduction = process.env.NODE_ENV === 'production';

// CORS options to allow frontend origins and credentials (cookies)
const allowedOrigins = [
  'https://pas.focusengineeringapp.com', // Production Frontend
  'https://tvs-tata-web.pages.dev', // Dev Frontend
  'http://localhost:5000', // Typical local URL
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json({
  limit: '50mb', // Security: increased to 50mb for large uploads
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ limit: '50mb', extended: true })); // Security: increased to 50mb for large uploads

// Security: Rate Limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per `window` (here, per 15 minutes)
  message: 'Too many login attempts from this IP, please try again after 15 minutes',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Import your routes
const authRoutes = require('./routes/authRoutes');
const teamRoutes = require('./routes/teamRoutes');
const rackRoutes = require('./routes/rackRoutes');
const exportedRackRoutes = require('./routes/exportedRackRoutes');
const masterdescRoutes = require('./routes/master_routes');
const webHookRouter = require('./routes/webHook');


app.use("/webhook", webHookRouter);
app.use('/api/auth/login', authLimiter); // Apply limiter only to login
app.use('/api/auth', authRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/racks', rackRoutes);
app.use('/api/exported-racks-snapshot', exportedRackRoutes);
app.use('/api', masterdescRoutes);

app.get('/', (req, res) => {
  res.send('Server is running.');
});

// Connect to MongoDB and start server
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  logger.info('MongoDB connected');
  app.listen(process.env.PORT || 5000, '0.0.0.0', () => {
    logger.info(`Server running on port ${process.env.PORT || 5000}`);
  });
}).catch((err) => logger.error('MongoDB connection error:', err));
