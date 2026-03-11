import { Request, Response } from 'express';
import { GameService } from '../services/GameService';

export class GameController {
  static getIndex(req: Request, res: Response) {
    try {
      const games = GameService.getIndex();
      res.json(games);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static getGame(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const game = GameService.getGameData(id);
      res.json(game);
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  }
}
