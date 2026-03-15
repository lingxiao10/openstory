import fs from 'fs';
import path from 'path';
import { GameIndex } from '../types';

const STORIES_BASE = path.resolve(__dirname, '../../stories');

export class GameService {
  static getIndex(): GameIndex[] {
    const indexPath = path.join(STORIES_BASE, 'index.json');
    const raw = fs.readFileSync(indexPath, 'utf-8');
    return JSON.parse(raw);
  }

  static getGameData(id: string): any {
    const index = this.getIndex();
    const game = index.find(g => g.id === id);
    if (!game) throw new Error('Game not found');

    const filePath = path.join(STORIES_BASE, game.file);
    const raw = fs.readFileSync(filePath, 'utf-8');
    return { ...game, data: JSON.parse(raw) };
  }
}
