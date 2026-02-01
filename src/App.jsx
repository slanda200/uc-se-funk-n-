import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Analytics } from "@vercel/analytics/react";

import Layout from "@/layout/Layout";

// Core pages
import Home from "@/pages/Home.jsx";
import Grades from "@/pages/Grades.jsx";
import Topics from "@/pages/Topics.jsx";
import Categories from "@/pages/Categories.jsx";
import Exercises from "@/pages/Exercises.jsx";
import Play from "@/pages/Play.jsx";

// User pages
import Profile from "@/pages/Profile.jsx";
import Typing from "@/pages/Typing.jsx";
import Leaderboard from "@/pages/Leaderboard.jsx";

// Reviews / results
import AttemptReview from "@/pages/AttemptReview.jsx";

// Extra pages
import Exam from "@/pages/Exam.jsx";

// 📚 KNIHOVNA
import Library from "@/pages/Library.jsx";

// 📖 Plné vysvětlení tématu
import TopicExplanation from "@/pages/TopicExplanation.jsx";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Layout>
          <Routes>
            {/* 🏠 Home */}
            <Route path="/" element={<Home />} />

            {/* 📘 Výběry */}
            <Route path="/grades" element={<Grades />} />
            <Route path="/topics" element={<Topics />} />
            <Route path="/categories" element={<Categories />} />

            {/* 🧠 KNIHOVNA */}
            <Route path="/library" element={<Library />} />
            <Route path="/Library" element={<Library />} />

            {/* 📝 Cvičení */}
            <Route path="/exercises" element={<Exercises />} />
            <Route path="/play" element={<Play />} />

            {/* 👤 Uživatel */}
            <Route path="/profile" element={<Profile />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/typing" element={<Typing />} />

            {/* 📊 Vyhodnocení */}
            <Route path="/AttemptReview" element={<AttemptReview />} />

            {/* 🎓 Test / zkoušky */}
            <Route path="/exam" element={<Exam />} />

            {/* 📖 Plné vysvětlení tématu */}
            <Route path="/TopicExplanation" element={<TopicExplanation />} />
            <Route path="/topicexplanation" element={<TopicExplanation />} />

            {/* ❌ Fallback – vždy až poslední */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Analytics />
        </Layout>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
