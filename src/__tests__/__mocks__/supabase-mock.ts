// Comprehensive Supabase mock for all tests
export const createSupabaseMock = () => {
  const mockChannel = {
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn().mockReturnValue({ 
      unsubscribe: jest.fn() 
    })
  };

  const mockFrom = jest.fn((table: string) => ({
    select: jest.fn().mockImplementation((...args) => ({
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      gt: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      like: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      contains: jest.fn().mockReturnThis(),
      containedBy: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      and: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      filter: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      then: jest.fn((onFulfilled) => {
        const result = { data: [], error: null, count: 0 };
        if (onFulfilled) onFulfilled(result);
        return Promise.resolve(result);
      }),
      catch: jest.fn(),
      finally: jest.fn()
    })),
    insert: jest.fn().mockImplementation((data) => ({
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: 'mock-id', ...data }, error: null }),
      then: jest.fn((onFulfilled) => {
        const result = { data: { id: 'mock-id', ...data }, error: null };
        if (onFulfilled) onFulfilled(result);
        return Promise.resolve(result);
      }),
      catch: jest.fn()
    })),
    upsert: jest.fn().mockImplementation((data) => ({
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: 'mock-id', ...data }, error: null }),
      then: jest.fn((onFulfilled) => {
        const result = { data: { id: 'mock-id', ...data }, error: null };
        if (onFulfilled) onFulfilled(result);
        return Promise.resolve(result);
      }),
      catch: jest.fn()
    })),
    update: jest.fn().mockImplementation((data) => ({
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { ...data }, error: null }),
      then: jest.fn((onFulfilled) => {
        const result = { data: { ...data }, error: null };
        if (onFulfilled) onFulfilled(result);
        return Promise.resolve(result);
      }),
      catch: jest.fn()
    })),
    delete: jest.fn().mockImplementation(() => ({
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      then: jest.fn((onFulfilled) => {
        const result = { data: null, error: null };
        if (onFulfilled) onFulfilled(result);
        return Promise.resolve(result);
      }),
      catch: jest.fn()
    })),
    rpc: jest.fn().mockResolvedValue({ data: null, error: null })
  }));

  return {
    from: mockFrom,
    channel: jest.fn(() => mockChannel),
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signIn: jest.fn().mockResolvedValue({ data: null, error: null }),
      signOut: jest.fn().mockResolvedValue({ error: null })
    },
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn().mockResolvedValue({ data: { path: 'mock-path' }, error: null }),
        download: jest.fn().mockResolvedValue({ data: new Blob(), error: null }),
        remove: jest.fn().mockResolvedValue({ data: null, error: null })
      }))
    },
    functions: {
      invoke: jest.fn().mockResolvedValue({ data: null, error: null })
    },
    realtime: {
      channel: jest.fn(() => mockChannel)
    }
  };
};

// Export singleton instance
export const supabaseMock = createSupabaseMock();