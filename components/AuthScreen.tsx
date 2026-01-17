
import React, { useState } from 'react';

interface AuthScreenProps {
  onLogin: () => void;
}

interface MockUser {
  email: string;
  password: string;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const getUsers = (): MockUser[] => {
    const users = localStorage.getItem('magic_storybook_users_db');
    return users ? JSON.parse(users) : [];
  };

  const saveUser = (user: MockUser) => {
    const users = getUsers();
    users.push(user);
    localStorage.setItem('magic_storybook_users_db', JSON.stringify(users));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const users = getUsers();

    if (isLogin) {
      // Login Logic
      const user = users.find(u => u.email === email && u.password === password);
      if (user) {
        localStorage.setItem('magic_storybook_user', 'true');
        onLogin();
      } else {
        const emailExists = users.some(u => u.email === email);
        if (!emailExists) {
          setError("Account not found! Please sign up first. ✨");
        } else {
          setError("Wrong password! Try again. 🗝️");
        }
      }
    } else {
      // Sign Up Logic
      const emailExists = users.some(u => u.email === email);
      if (emailExists) {
        setError("This email already has an account! Try logging in. 🐉");
      } else {
        saveUser({ email, password });
        setSuccess("Account created! Now you can log in. 🎈");
        setIsLogin(true);
        setPassword(''); // Clear password for login
      }
    }
  };

  const handleGoogleLogin = () => {
    // Google Login acts as an "Instant Access" for the demo
    localStorage.setItem('magic_storybook_user', 'true');
    onLogin();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-indigo-100 via-purple-50 to-amber-50">
      <div className="w-full max-w-md animate-in fade-in zoom-in duration-700">
        <div className="text-center mb-10">
          <div className="bg-yellow-400 w-24 h-24 rounded-[2rem] shadow-xl flex items-center justify-center mx-auto mb-6 transform -rotate-6 animate-float">
            <span className="text-5xl">📖</span>
          </div>
          <h1 className="text-4xl text-indigo-950 font-kids mb-2">Magic Storybook AI</h1>
          <p className="text-indigo-600 font-bold">Your portal to endless adventures!</p>
        </div>

        <div className="bg-white rounded-[3rem] shadow-2xl border-b-[12px] border-indigo-100 p-8 md:p-12">
          <div className="flex bg-indigo-50 p-2 rounded-2xl mb-8">
            <button 
              onClick={() => { setIsLogin(true); setError(null); setSuccess(null); }}
              className={`flex-1 py-3 rounded-xl font-kids text-lg transition-all ${isLogin ? 'bg-white text-indigo-600 shadow-md' : 'text-indigo-400'}`}
            >
              Login
            </button>
            <button 
              onClick={() => { setIsLogin(false); setError(null); setSuccess(null); }}
              className={`flex-1 py-3 rounded-xl font-kids text-lg transition-all ${!isLogin ? 'bg-white text-indigo-600 shadow-md' : 'text-indigo-400'}`}
            >
              Sign Up
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl border-2 border-red-100 text-sm font-bold text-center animate-shake">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-50 text-green-600 rounded-2xl border-2 border-green-100 text-sm font-bold text-center">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-indigo-900 font-bold mb-2 ml-2">Email Address</label>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="dragon@magic.com"
                className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-2 border-gray-100 focus:border-indigo-400 outline-none transition-all text-indigo-950 font-bold placeholder:text-indigo-200"
              />
            </div>
            <div>
              <label className="block text-indigo-900 font-bold mb-2 ml-2">Password</label>
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-2 border-gray-100 focus:border-indigo-400 outline-none transition-all text-indigo-950 font-bold placeholder:text-indigo-200"
              />
            </div>
            
            <button 
              type="submit"
              className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-kids text-xl py-5 rounded-2xl shadow-lg transition-all transform active:scale-95 mt-4 border-b-4 border-indigo-700 active:border-b-0"
            >
              {isLogin ? "Let's Play! 🚀" : "Create My Account! ✨"}
            </button>
          </form>

          <div className="my-8 flex items-center gap-4">
            <div className="h-px flex-1 bg-gray-100"></div>
            <span className="text-gray-400 font-bold text-sm uppercase">OR</span>
            <div className="h-px flex-1 bg-gray-100"></div>
          </div>

          <button 
            onClick={handleGoogleLogin}
            className="w-full bg-white border-2 border-gray-100 hover:border-indigo-200 text-gray-700 font-bold py-4 rounded-2xl shadow-sm transition-all flex items-center justify-center gap-3 active:scale-95"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-6 h-6" />
            Continue with Google
          </button>
        </div>

        <p className="text-center mt-8 text-indigo-400 font-medium">
          By playing, you agree to our <span className="underline cursor-pointer">Magic Rules</span>
        </p>
      </div>
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-shake {
          animation: shake 0.3s ease-in-out 0s 2;
        }
      `}</style>
    </div>
  );
};
