
export interface League {
  id: string;
  name: string;
  startTime: string;
  description: string;
}

export const LEAGUES: League[] = [
  { id: 'A1', name: 'Лига A1', startTime: '08:00', description: 'Утренняя элита. Для тех, кто начинает день с побед.' },
  { id: 'A2', name: 'Лига A2', startTime: '09:00', description: 'Стратегический подъем. Время для первых маневров.' },
  { id: 'B1', name: 'Лига B1', startTime: '10:00', description: 'Стабильность и мощь. Пик утренней активности.' },
  { id: 'B2', name: 'Лига B2', startTime: '11:00', description: 'Поздний завтрак чемпионов. Время тактических решений.' },
  { id: 'C1', name: 'Лига C1', startTime: '12:00', description: 'Полуденная битва. Жаркое время в центре арены.' },
  { id: 'C2', name: 'Лига C2', startTime: '13:00', description: 'Обеденный перерыв для слабых, время боя для сильных.' },
  { id: 'D1', name: 'Лига D1', startTime: '14:00', description: 'Дневное господство. Покажите свой класс.' },
  { id: 'D2', name: 'Лига D2', startTime: '15:00', description: 'Энергия дня. Время для решительных действий.' },
  { id: 'E1', name: 'Лига E1', startTime: '16:00', description: 'Предвечерний штурм. Подготовка к главным событиям.' },
  { id: 'E2', name: 'Лига E2', startTime: '17:00', description: 'Закат над ареной. Битва за респект.' },
  { id: 'F1', name: 'Лига F1', startTime: '18:00', description: 'Вечерний прайм-тайм. Самые жаркие матчи.' },
  { id: 'F2', name: 'Лига F2', startTime: '19:00', description: 'Золотой час тактики. Время профи.' },
  { id: 'G1', name: 'Лига G1', startTime: '20:00', description: 'Ночной дозор. Стратегия под покровом тьмы.' },
  { id: 'G2', name: 'Лига G2', startTime: '21:00', description: 'Поздний прайм. Битва за лидерство.' },
  { id: 'H1', name: 'Лига H1', startTime: '22:00', description: 'Ночная стража. Только для самых стойких.' },
  { id: 'H2', name: 'Лига H2', startTime: '23:00', description: 'Полночный гром. Финальные аккорды дня.' },
];
