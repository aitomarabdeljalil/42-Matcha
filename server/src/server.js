require('dotenv').config();
const app = require('./app');
const db = require('./config/database');

const PORT = process.env.PORT || 8000;

// Test database connection
db.raw('SELECT 1')
  .then(() => {
    console.log('✅ Database connected successfully');
    
    // Run migrations in development
    if (process.env.NODE_ENV === 'development') {
      db.migrate.latest()
        .then(() => console.log('✅ Database migrations applied'))
        .catch(err => console.error('❌ Migration error:', err));
    }

    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📝 Environment: ${process.env.NODE_ENV}`);
      console.log(`🌍 Health check: http://localhost:${PORT}/health`);
    });
  })
  .catch(err => {
    console.error('❌ Database connection failed:', err);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  db.destroy();
  process.exit(0);
});