import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import gameRoutes from './routes/games';
import storyRoutes from './routes/stories';
import generateRoutes from './routes/generate';
import progressRoutes from './routes/progress';
import { errorHandler } from './middleware/error';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/generate', generateRoutes);
app.use('/api/progress', progressRoutes);

app.use(errorHandler);

export default app;
