import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, RotateCcw } from 'lucide-react';
import confetti from './confetti';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

export default function SortExercise({ exercise, onComplete }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [items, setItems] = useState(() => {
    const current = exercise.questions[0];
    const allItems = current.categories?.flatMap(cat => cat.items) || [];
    return allItems;
  });
  const [categoryItems, setCategoryItems] = useState({});
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);

  const current = exercise.questions[currentIndex];

  const onDragEnd = (result) => {
    if (showResult) return;
    const { source, destination } = result;
    if (!destination) return;

    // Moving from items pool to category
    if (source.droppableId === 'items' && destination.droppableId !== 'items') {
      const newItems = [...items];
      const [movedItem] = newItems.splice(source.index, 1);
      setItems(newItems);

      setCategoryItems(prev => ({
        ...prev,
        [destination.droppableId]: [...(prev[destination.droppableId] || []), movedItem]
      }));
    }
    // Moving from category back to items pool
    else if (source.droppableId !== 'items' && destination.droppableId === 'items') {
      const categoryName = source.droppableId;
      const newCategoryItems = [...(categoryItems[categoryName] || [])];
      const [movedItem] = newCategoryItems.splice(source.index, 1);

      setCategoryItems(prev => ({
        ...prev,
        [categoryName]: newCategoryItems
      }));

      const newItems = [...items];
      newItems.splice(destination.index, 0, movedItem);
      setItems(newItems);
    }
    // Moving between categories
    else if (source.droppableId !== destination.droppableId) {
      const sourceCat = source.droppableId;
      const destCat = destination.droppableId;
      
      const sourceItems = [...(categoryItems[sourceCat] || [])];
      const destItems = [...(categoryItems[destCat] || [])];
      
      const [movedItem] = sourceItems.splice(source.index, 1);
      destItems.splice(destination.index, 0, movedItem);
      
      setCategoryItems(prev => ({
        ...prev,
        [sourceCat]: sourceItems,
        [destCat]: destItems
      }));
    }
    // Reordering within same category
    else if (source.droppableId === destination.droppableId && source.droppableId !== 'items') {
      const categoryName = source.droppableId;
      const newItems = [...(categoryItems[categoryName] || [])];
      const [movedItem] = newItems.splice(source.index, 1);
      newItems.splice(destination.index, 0, movedItem);
      
      setCategoryItems(prev => ({
        ...prev,
        [categoryName]: newItems
      }));
    }
  };

  const handleCheck = () => {
    let correctCount = 0;
    let totalCount = 0;

    current.categories.forEach(category => {
      const placedItems = categoryItems[category.name] || [];
      category.items.forEach(correctItem => {
        totalCount++;
        if (placedItems.includes(correctItem)) {
          correctCount++;
        }
      });
    });

    const questionScore = Math.round((correctCount / totalCount) * 100);
    if (questionScore === 100) {
      confetti();
      setScore(score + 1);
    }
    setShowResult(true);

    setTimeout(() => {
      if (currentIndex < exercise.questions.length - 1) {
        const nextQuestion = exercise.questions[currentIndex + 1];
        const nextItems = nextQuestion.categories?.flatMap(cat => cat.items) || [];
        setCurrentIndex(currentIndex + 1);
        setItems(nextItems);
        setCategoryItems({});
        setShowResult(false);
      } else {
        const finalScore = Math.round(((score + (questionScore === 100 ? 1 : 0)) / exercise.questions.length) * 100);
        const stars = finalScore >= 80 ? 3 : finalScore >= 60 ? 2 : 1;
        onComplete(finalScore, stars);
      }
    }, 2500);
  };

  const handleRetry = () => {
    const allItems = current.categories?.flatMap(cat => cat.items) || [];
    setItems(allItems);
    setCategoryItems({});
    setShowResult(false);
  };

  const isCorrectPlacement = (item, categoryName) => {
    const correctCategory = current.categories.find(cat => cat.items.includes(item));
    return correctCategory?.name === categoryName;
  };

  const allPlaced = items.length === 0;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex justify-between text-sm text-slate-600 mb-2">
          <span>Úkol {currentIndex + 1} z {exercise.questions.length}</span>
          <span>Skóre: {score}/{exercise.questions.length}</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-lg mb-6">
        <h3 className="text-xl font-bold text-slate-800 mb-4">{current.question}</h3>
        
        <DragDropContext onDragEnd={onDragEnd}>
          {/* Items pool */}
          <div className="mb-6">
            <p className="text-sm text-slate-600 mb-3">Přetáhni prvky do správných kategorií:</p>
            <Droppable droppableId="items" direction="horizontal">
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`min-h-[80px] p-4 rounded-xl border-2 border-dashed transition-colors ${
                    snapshot.isDraggingOver ? 'border-blue-400 bg-blue-50' : 'border-slate-300 bg-slate-50'
                  }`}
                >
                  <div className="flex flex-wrap gap-2">
                    {items.map((item, index) => (
                      <Draggable key={item} draggableId={item} index={index} isDragDisabled={showResult}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`px-4 py-2 rounded-lg font-medium text-lg cursor-move transition-all ${
                              snapshot.isDragging 
                                ? 'bg-blue-500 text-white shadow-lg scale-105' 
                                : 'bg-slate-200 text-slate-800 hover:bg-slate-300'
                            }`}
                          >
                            {item}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                  {items.length === 0 && !showResult && (
                    <p className="text-slate-400 text-center text-sm">Všechny prvky roztříděny</p>
                  )}
                </div>
              )}
            </Droppable>
          </div>

          {/* Categories */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {current.categories?.map((category) => (
              <Droppable key={category.name} droppableId={category.name}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`border-2 rounded-xl p-4 transition-colors ${
                      snapshot.isDraggingOver 
                        ? 'border-emerald-400 bg-emerald-50' 
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <h4 className="font-bold text-slate-700 mb-3 text-lg">{category.name}</h4>
                    <div className="space-y-2 min-h-[120px]">
                      {(categoryItems[category.name] || []).map((item, index) => {
                        const isCorrect = showResult && isCorrectPlacement(item, category.name);
                        const isWrong = showResult && !isCorrectPlacement(item, category.name);
                        
                        return (
                          <Draggable key={item} draggableId={item} index={index} isDragDisabled={showResult}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`px-4 py-3 rounded-lg font-medium text-lg transition-all ${
                                  snapshot.isDragging
                                    ? 'bg-blue-500 text-white shadow-lg scale-105'
                                    : isCorrect
                                      ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-300'
                                      : isWrong
                                        ? 'bg-red-100 text-red-700 border-2 border-red-300'
                                        : 'bg-blue-50 text-blue-700 border border-blue-200 cursor-move hover:bg-blue-100'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span>{item}</span>
                                  {showResult && (
                                    isCorrect ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />
                                  )}
                                </div>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            ))}
          </div>
        </DragDropContext>

        {/* Actions */}
        <div className="flex gap-3">
          {showResult && (
            <Button onClick={handleRetry} variant="outline" className="h-12 px-6 rounded-2xl border-2">
              <RotateCcw className="w-5 h-5 mr-2" />
              Opravit
            </Button>
          )}
          {!showResult && allPlaced && (
            <Button onClick={handleCheck} className="flex-1 h-12 text-lg bg-gradient-to-r from-blue-500 to-purple-500">
              Zkontrolovat
            </Button>
          )}
        </div>

        {/* Result */}
        {showResult && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-4 rounded-xl bg-slate-50"
          >
            {(() => {
              let correctCount = 0;
              let totalCount = 0;
              current.categories.forEach(cat => {
                const placed = categoryItems[cat.name] || [];
                cat.items.forEach(item => {
                  totalCount++;
                  if (placed.includes(item)) correctCount++;
                });
              });
              const percentage = Math.round((correctCount / totalCount) * 100);
              
              return (
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-800">
                    {correctCount} / {totalCount} správně ({percentage}%)
                  </p>
                </div>
              );
            })()}
          </motion.div>
        )}
      </div>
    </div>
  );
}