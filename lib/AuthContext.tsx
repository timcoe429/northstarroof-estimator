'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  companyId: string | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);

  // Fetch company_id from profile after auth state is set (non-blocking)
  const fetchCompanyId = async (userId: string) => {
    console.log('[AuthContext] Starting profile fetch for companyId, userId:', userId);
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('[AuthContext] Failed to fetch company_id:', error);
        console.log('[AuthContext] Setting companyId to null due to error');
        setCompanyId(null);
        return;
      }

      console.log('[AuthContext] Profile fetch successful, company_id:', profile?.company_id);
      setCompanyId(profile?.company_id ?? null);
    } catch (error) {
      console.error('[AuthContext] Error fetching company_id:', error);
      console.log('[AuthContext] Setting companyId to null due to exception');
      setCompanyId(null);
    }
  };

  useEffect(() => {
    // Get initial session
    console.log('[AuthContext] Getting initial session...');
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log('[AuthContext] Initial session retrieved:', session ? 'authenticated' : 'no session');
      setSession(session);
      setUser(session?.user ?? null);
      
      // Set loading to false immediately - don't wait for companyId fetch
      console.log('[AuthContext] Setting loading to false');
      setLoading(false);
      
      // Fetch company_id asynchronously (non-blocking)
      if (session?.user?.id) {
        console.log('[AuthContext] User authenticated, fetching companyId asynchronously');
        fetchCompanyId(session.user.id).catch(err => {
          console.error('[AuthContext] Unhandled error in fetchCompanyId:', err);
          setCompanyId(null);
        });
      } else {
        console.log('[AuthContext] No user session, setting companyId to null');
        setCompanyId(null);
      }
    }).catch(error => {
      console.error('[AuthContext] Error getting initial session:', error);
      setLoading(false);
      setCompanyId(null);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log('[AuthContext] Auth state changed, event:', _event, 'session:', session ? 'authenticated' : 'no session');
      setSession(session);
      setUser(session?.user ?? null);
      
      // Set loading to false immediately - don't wait for companyId fetch
      console.log('[AuthContext] Setting loading to false');
      setLoading(false);
      
      // Fetch company_id asynchronously (non-blocking)
      if (session?.user?.id) {
        console.log('[AuthContext] User authenticated, fetching companyId asynchronously');
        fetchCompanyId(session.user.id).catch(err => {
          console.error('[AuthContext] Unhandled error in fetchCompanyId:', err);
          setCompanyId(null);
        });
      } else {
        console.log('[AuthContext] No user session, setting companyId to null');
        setCompanyId(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, companyId, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
