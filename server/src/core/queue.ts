// local question queue

import type { Question } from '../types';

class QuestionQueue {
  private queue: Question[] = [];
  private processing = false;

  add(question: string): Question {
    const q: Question = {
      id: crypto.randomUUID(),
      question,
      createdAt: Date.now(),
      status: 'pending',
    };
    this.queue.push(q);
    return q;
  }

  getNext(): Question | undefined {
    return this.queue.find(q => q.status === 'pending');
  }

  update(id: string, updates: Partial<Question>): void {
    const q = this.queue.find(q => q.id === id);
    if (q) {
      Object.assign(q, updates);
    }
  }

  get(id: string): Question | undefined {
    return this.queue.find(q => q.id === id);
  }

  getAll(): Question[] {
    return [...this.queue];
  }

  setProcessing(value: boolean): void {
    this.processing = value;
  }

  isProcessing(): boolean {
    return this.processing;
  }
}

export const questionQueue = new QuestionQueue();
