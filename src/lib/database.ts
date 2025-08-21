import { supabase } from './supabase';

export { supabase };

export interface DatabaseOperations {
  insert: (table: string, data: any) => Promise<void>;
  update: (table: string, id: string, data: any) => Promise<void>;
  select: (table: string, query?: any) => Promise<any[]>;
  delete: (table: string, id: string) => Promise<void>;
  upsert: (table: string, data: any) => Promise<void>;
}

export const database: DatabaseOperations = {
  async insert(table: string, data: any): Promise<void> {
    const { error } = await supabase
      .from(table)
      .insert(data);
    
    if (error) {
      throw new Error(`Database insert error: ${error.message}`);
    }
  },

  async update(table: string, id: string, data: any): Promise<void> {
    const { error } = await supabase
      .from(table)
      .update(data)
      .eq('id', id);
    
    if (error) {
      throw new Error(`Database update error: ${error.message}`);
    }
  },

  async select(table: string, query?: any): Promise<any[]> {
    let queryBuilder = supabase.from(table).select('*');
    
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        queryBuilder = queryBuilder.eq(key, value);
      });
    }
    
    const { data, error } = await queryBuilder;
    
    if (error) {
      throw new Error(`Database select error: ${error.message}`);
    }
    
    return data || [];
  },

  async delete(table: string, id: string): Promise<void> {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', id);
    
    if (error) {
      throw new Error(`Database delete error: ${error.message}`);
    }
  },

  async upsert(table: string, data: any): Promise<void> {
    const { error } = await supabase
      .from(table)
      .upsert(data);
    
    if (error) {
      throw new Error(`Database upsert error: ${error.message}`);
    }
  }
};

// Export helper functions for specific tables
export async function saveContent(content: any): Promise<void> {
  return database.insert('content_queue', content);
}

export async function updateContent(id: string, updates: any): Promise<void> {
  return database.update('content_queue', id, updates);
}

export async function getContent(query?: any): Promise<any[]> {
  return database.select('content_queue', query);
}

export async function saveFetchHistory(history: any): Promise<void> {
  return database.insert('fetch_history', history);
}

export async function saveProcessingHistory(history: any): Promise<void> {
  return database.insert('processing_history', history);
}

export async function getSystemConfig(key?: string): Promise<any> {
  if (key) {
    const results = await database.select('system_config', { key });
    return results[0]?.value;
  }
  return database.select('system_config');
}

export async function setSystemConfig(key: string, value: any): Promise<void> {
  return database.upsert('system_config', { key, value, updated_at: new Date().toISOString() });
}