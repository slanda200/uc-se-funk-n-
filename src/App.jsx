import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import Layout from "@/layout/Layout";

import Home from '@/pages/Home.jsx';
import Grades from '@/pages/Grades.jsx';
import Topics from '@/pages/Topics.jsx';
import Categories from '@/pages/Categories.jsx';
import Exercises from '@/pages/Exercises.jsx';
import Play from '@/pages/Play.jsx';
import Profile from '@/pages/Profile.jsx';
import Typing from '@/pages/Typing.jsx';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/grades" element={<Grades />} />
            <Route path="/topics" element={<Topics />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/exercises" element={<Exercises />} />
            <Route path="/play" element={<Play />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/typing" element={<Typing />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
