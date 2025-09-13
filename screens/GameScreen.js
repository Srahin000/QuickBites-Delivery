import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  PanResponder,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import supabase from "../supabaseClient"
import { useSession } from '../context/SessionContext-v2';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CELL_SIZE = 20;
const MIN_SWIPE_DISTANCE = 5;
const DIRECTIONS = {
  right: { x: 1, y: 0 },
  left: { x: -1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};

const TOP_BANNER_HEIGHT = 80;

const SnakeGame = () => {
  const navigation = useNavigation();
  const { session } = useSession();
  const [snake, setSnake] = useState([{ x: 5, y: 5 }]);
  const [food, setFood] = useState(randomFoodPos([{ x: 5, y: 5 }]));
  const [score, setScore] = useState(0);
  const [gameOverVisible, setGameOverVisible] = useState(false);
  const [topScores, setTopScores] = useState([]);
  const [speed, setSpeed] = useState(150);

  const dirRef = useRef(DIRECTIONS.right);
  const interval = useRef(null);
  const scoreRef = useRef(0);
  const foodRef = useRef(food);

  useEffect(() => { foodRef.current = food; }, [food]);
  useEffect(() => { scoreRef.current = score; }, [score]);

  useEffect(() => {
    startGame();
    return () => clearInterval(interval.current);
  }, []);

  const startGame = () => {
    clearInterval(interval.current);
    interval.current = setInterval(() => {
      setSnake(prevSnake => {
        const newHead = {
          x: prevSnake[0].x + dirRef.current.x,
          y: prevSnake[0].y + dirRef.current.y,
        };

        if (isCollision(newHead)) {
          handleGameOver();
          return prevSnake;
        }

        const ateFood = newHead.x === foodRef.current.x && newHead.y === foodRef.current.y;
        const newSnake = [newHead];

        if (ateFood) {
          setScore(prev => prev + 1);
          setFood(randomFoodPos(newSnake));
          const nextSpeed = Math.max(speed - 5, 80);
          setSpeed(nextSpeed);
          clearInterval(interval.current);
          setTimeout(startGame, 0);
        }

        return newSnake;
      });
    }, speed);
  };

  const isCollision = (head) => {
    return (
      head.x < 0 ||
      head.y < Math.ceil(TOP_BANNER_HEIGHT / CELL_SIZE) ||
      head.x * CELL_SIZE >= SCREEN_WIDTH ||
      head.y * CELL_SIZE >= SCREEN_HEIGHT
    );
  };

  const handleGameOver = async () => {
    clearInterval(interval.current);
    setGameOverVisible(true);
    await fetchTopScores();

    const finalScore = scoreRef.current;
    if (!session?.user) return;

    // Fetch name and email from users table
    let name = '';
    let email = session.user.email;
    try {
      const { data: userProfile } = await supabase
        .from('users')
        .select('first_name, email')
        .eq('id', session.user.id)
        .single();
      if (userProfile) {
        name = userProfile.first_name || '';
        email = userProfile.email || email;
      }
    } catch (e) {}

    // Fetch current highest_score
    const { data: existingScore } = await supabase
      .from('scores')
      .select('highest_score')
      .eq('user_id', session.user.id)
      .single();

    const previousHigh = existingScore?.highest_score ?? 0;

    // Only update if the new score is higher
    if (finalScore > previousHigh) {
    await supabase.from('scores').upsert({
      user_id: session.user.id,
        name,
        email,
        highest_score: finalScore,
        last_played: new Date().toISOString()
    }, { onConflict: 'user_id' });
    }

    const { data: leaderData } = await supabase
      .from('leaderboard')
      .select('top_score')
      .eq('id', 1)
      .single();

    if (leaderData?.top_score < finalScore) {
      await supabase
        .from('leaderboard')
        .update({ top_score: finalScore, top_user: session.user.id })
        .eq('id', 1);
    }
  };

  const fetchTopScores = async () => {
    const { data, error } = await supabase
      .from('scores')
      .select('name, highest_score, score_time')
      .order('highest_score', { ascending: false })
      .limit(10);

    const resolved = (data || []).map(entry => ({
      name: entry.name || 'Anonymous',
      score: entry.highest_score,
      score_time: entry.score_time ? new Date(entry.score_time).toLocaleString() : '-'
    }));

    setTopScores(resolved);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, { dx, dy }) => {
        const current = dirRef.current;
        if (Math.abs(dx) > Math.abs(dy)) {
          if (dx > MIN_SWIPE_DISTANCE && current !== DIRECTIONS.left) dirRef.current = DIRECTIONS.right;
          else if (dx < -MIN_SWIPE_DISTANCE && current !== DIRECTIONS.right) dirRef.current = DIRECTIONS.left;
        } else {
          if (dy > MIN_SWIPE_DISTANCE && current !== DIRECTIONS.up) dirRef.current = DIRECTIONS.down;
          else if (dy < -MIN_SWIPE_DISTANCE && current !== DIRECTIONS.down) dirRef.current = DIRECTIONS.up;
        }
      },
    })
  ).current;

  return (
    <View className="flex-1 bg-yellow-100" {...panResponder.panHandlers}>
      <View className="flex-row items-center justify-between px-4 pt-12 pb-3 bg-yellow-200">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text className="text-lg font-bold text-blue-800">←</Text>
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-green-700">Score: {score}</Text>
      </View>

      <Image
        source={require('../assets/Screenshot_2025-05-04_114749-removebg-preview.png')}
        className="absolute"
        style={{
          width: CELL_SIZE,
          height: CELL_SIZE,
          left: snake[0].x * CELL_SIZE,
          top: snake[0].y * CELL_SIZE,
          resizeMode: 'contain',
        }}
      />

      <Image
        source={require('../assets/icons8-hamburger-96.png')}
        className="absolute"
        style={{
          width: CELL_SIZE,
          height: CELL_SIZE,
          left: food.x * CELL_SIZE,
          top: food.y * CELL_SIZE,
          resizeMode: 'contain',
        }}
      />

      {gameOverVisible && (
        <View className="absolute top-28 left-8 right-8 bg-white p-5 rounded-xl shadow-xl items-center">
          <Text className="text-2xl font-bold mb-2">Game Over</Text>
          <Text className="text-lg mb-2">Your Score: {scoreRef.current}</Text>
          
          <View className="flex-row space-x-4 mt-4">
            <Text
              onPress={() => {
                setGameOverVisible(false);
                setSnake([{ x: 5, y: 5 }]);
                setFood(randomFoodPos([{ x: 5, y: 5 }]));
                setScore(0);
                setSpeed(150);
                dirRef.current = DIRECTIONS.right;
                startGame();
              }}
              className="px-4 py-2 bg-green-500 rounded-full text-white font-bold"
            >
              Play Again
            </Text>
            <Text
              onPress={() => navigation.goBack()}
              className="px-4 py-2 bg-red-500 rounded-full text-white font-bold"
            >
              Exit
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

const randomFoodPos = (snake) => {
  let newPos;
  do {
    newPos = {
      x: Math.floor(Math.random() * Math.floor(SCREEN_WIDTH / CELL_SIZE)),
      y: Math.floor(Math.random() * Math.floor((SCREEN_HEIGHT - TOP_BANNER_HEIGHT) / CELL_SIZE)) + Math.ceil(TOP_BANNER_HEIGHT / CELL_SIZE),
    };
  } while (snake.some(seg => seg.x === newPos.x && seg.y === newPos.y));
  return newPos;
};

export default SnakeGame;