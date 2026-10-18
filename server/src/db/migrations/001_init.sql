create table accounts (
  id integer primary key,
  name text not null,
  kind text not null check (kind in ('card','cash','deposit')),
  owner text not null check (owner in ('sasha','tanya','shared')),
  opening_balance integer not null default 0,
  opening_date text not null,
  archived integer not null default 0,
  sort_order integer not null default 0
);

create table categories (
  id integer primary key,
  name text not null,
  group_name text not null,
  kind text not null check (kind in ('expense','income')),
  color text not null,
  icon text,
  slug text unique,
  archived integer not null default 0,
  sort_order integer not null default 0
);

create table transactions (
  id integer primary key,
  kind text not null check (kind in ('expense','income','transfer')),
  date text not null,
  amount integer not null check (amount > 0),
  account_id integer not null references accounts(id),
  transfer_account_id integer references accounts(id),
  category_id integer references categories(id),
  person text check (person in ('sasha','tanya')),
  comment text not null default '',
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

create index transactions_date on transactions(date);
create index transactions_account on transactions(account_id);
create index transactions_category on transactions(category_id);

create table balance_checks (
  id integer primary key,
  account_id integer not null references accounts(id),
  date text not null,
  computed integer not null,
  actual integer not null,
  diff integer not null,
  correction_id integer references transactions(id),
  created_at text not null default (datetime('now')),
  unique (account_id, date)
);

create table sessions (
  token_hash text primary key,
  created_at text not null,
  expires_at text not null
);

insert into accounts (name, kind, owner, opening_balance, opening_date, sort_order) values
  ('Карта Саши', 'card', 'sasha', 0, date('now'), 1),
  ('Карта Тани', 'card', 'tanya', 0, date('now'), 2),
  ('Наличные', 'cash', 'shared', 0, date('now'), 3),
  ('Вклад Саши', 'deposit', 'sasha', 0, date('now'), 4),
  ('Вклад Тани', 'deposit', 'tanya', 0, date('now'), 5);

insert into categories (name, group_name, kind, color, icon, slug, sort_order) values
  ('Аренда и ипотека', 'Дом', 'expense', '#38BDF8', '🏠', null, 1),
  ('ЖКХ', 'Дом', 'expense', '#38BDF8', '🧾', null, 2),
  ('Электричество', 'Дом', 'expense', '#38BDF8', '💡', null, 3),
  ('Вода и канализация', 'Дом', 'expense', '#38BDF8', '🚿', null, 4),
  ('Газ', 'Дом', 'expense', '#38BDF8', '🔥', null, 5),
  ('Отопление', 'Дом', 'expense', '#38BDF8', '♨️', null, 6),
  ('Интернет', 'Дом', 'expense', '#38BDF8', '🌐', null, 7),
  ('ТВ и подписки на ТВ', 'Дом', 'expense', '#38BDF8', '📺', null, 8),
  ('Мобильная связь', 'Дом', 'expense', '#38BDF8', '📱', null, 9),
  ('Ремонт', 'Дом', 'expense', '#38BDF8', '🛠️', null, 10),
  ('Мебель', 'Дом', 'expense', '#38BDF8', '🪑', null, 11),
  ('Бытовая техника', 'Дом', 'expense', '#38BDF8', '🧺', null, 12),
  ('Хозтовары', 'Дом', 'expense', '#38BDF8', '🧴', null, 13),
  ('Бытовая химия', 'Дом', 'expense', '#38BDF8', '🧼', null, 14),
  ('Охрана и домофон', 'Дом', 'expense', '#38BDF8', '🔒', null, 15),

  ('Продукты', 'Еда', 'expense', '#34D399', '🛒', null, 16),
  ('Доставка еды', 'Еда', 'expense', '#34D399', '🛵', null, 17),
  ('Кафе и рестораны', 'Еда', 'expense', '#34D399', '🍽️', null, 18),
  ('Кофе', 'Еда', 'expense', '#34D399', '☕', null, 19),
  ('Алкоголь', 'Еда', 'expense', '#34D399', '🍷', null, 20),
  ('Обеды на работе', 'Еда', 'expense', '#34D399', '🥡', null, 21),
  ('Сладости', 'Еда', 'expense', '#34D399', '🍰', null, 22),

  ('Такси', 'Транспорт', 'expense', '#FBBF24', '🚕', null, 23),
  ('Общественный транспорт', 'Транспорт', 'expense', '#FBBF24', '🚇', null, 24),
  ('Бензин', 'Транспорт', 'expense', '#FBBF24', '⛽', null, 25),
  ('Парковка', 'Транспорт', 'expense', '#FBBF24', '🅿️', null, 26),
  ('Мойка', 'Транспорт', 'expense', '#FBBF24', '🧽', null, 27),
  ('ТО и ремонт авто', 'Транспорт', 'expense', '#FBBF24', '🔧', null, 28),
  ('Запчасти', 'Транспорт', 'expense', '#FBBF24', '⚙️', null, 29),
  ('Страховка авто', 'Транспорт', 'expense', '#FBBF24', '🛡️', null, 30),
  ('Штрафы', 'Транспорт', 'expense', '#FBBF24', '🚨', null, 31),
  ('Каршеринг', 'Транспорт', 'expense', '#FBBF24', '🚙', null, 32),
  ('Самокаты', 'Транспорт', 'expense', '#FBBF24', '🛴', null, 33),

  ('Стриминг видео', 'Подписки и сервисы', 'expense', '#A78BFA', '🎬', null, 34),
  ('Музыка', 'Подписки и сервисы', 'expense', '#A78BFA', '🎧', null, 35),
  ('Облачное хранилище', 'Подписки и сервисы', 'expense', '#A78BFA', '☁️', null, 36),
  ('Нейросети и AI', 'Подписки и сервисы', 'expense', '#A78BFA', '🤖', null, 37),
  ('Хостинг и домены', 'Подписки и сервисы', 'expense', '#A78BFA', '🖥️', null, 38),
  ('Софт и лицензии', 'Подписки и сервисы', 'expense', '#A78BFA', '💾', null, 39),
  ('Игры', 'Подписки и сервисы', 'expense', '#A78BFA', '🎮', null, 40),
  ('Мобильные приложения', 'Подписки и сервисы', 'expense', '#A78BFA', '📲', null, 41),
  ('VPN', 'Подписки и сервисы', 'expense', '#A78BFA', '🔐', null, 42),
  ('Донаты и бусты', 'Подписки и сервисы', 'expense', '#A78BFA', '💎', null, 43),
  ('Онлайн-кинотеатр', 'Подписки и сервисы', 'expense', '#A78BFA', '🍿', null, 44),
  ('Книги и аудиокниги по подписке', 'Подписки и сервисы', 'expense', '#A78BFA', '📚', null, 45),

  ('Аптека', 'Здоровье', 'expense', '#FB7185', '💊', null, 46),
  ('Врачи и клиники', 'Здоровье', 'expense', '#FB7185', '🩺', null, 47),
  ('Анализы', 'Здоровье', 'expense', '#FB7185', '🧪', null, 48),
  ('Стоматология', 'Здоровье', 'expense', '#FB7185', '🦷', null, 49),
  ('Оптика', 'Здоровье', 'expense', '#FB7185', '👓', null, 50),
  ('Фитнес и спорт', 'Здоровье', 'expense', '#FB7185', '🏋️', null, 51),
  ('Психолог', 'Здоровье', 'expense', '#FB7185', '🧠', null, 52),
  ('Страховка', 'Здоровье', 'expense', '#FB7185', '🏥', null, 53),
  ('Витамины и БАДы', 'Здоровье', 'expense', '#FB7185', '🍊', null, 54),

  ('Одежда', 'Покупки', 'expense', '#F472B6', '👕', null, 55),
  ('Обувь', 'Покупки', 'expense', '#F472B6', '👟', null, 56),
  ('Аксессуары', 'Покупки', 'expense', '#F472B6', '👜', null, 57),
  ('Электроника', 'Покупки', 'expense', '#F472B6', '💻', null, 58),
  ('Гаджеты', 'Покупки', 'expense', '#F472B6', '⌚', null, 59),
  ('Товары для дома и декор', 'Покупки', 'expense', '#F472B6', '🖼️', null, 60),
  ('Маркетплейсы', 'Покупки', 'expense', '#F472B6', '📦', null, 61),
  ('Книги и канцелярия', 'Покупки', 'expense', '#F472B6', '✏️', null, 62),
  ('Зоотовары', 'Покупки', 'expense', '#F472B6', '🐾', null, 63),

  ('Кино и театр', 'Досуг', 'expense', '#22D3EE', '🎭', null, 64),
  ('Концерты', 'Досуг', 'expense', '#22D3EE', '🎤', null, 65),
  ('Музеи и выставки', 'Досуг', 'expense', '#22D3EE', '🖼️', null, 66),
  ('Поездки и отели', 'Досуг', 'expense', '#22D3EE', '🏨', null, 67),
  ('Билеты на транспорт', 'Досуг', 'expense', '#22D3EE', '🎫', null, 68),
  ('Хобби', 'Досуг', 'expense', '#22D3EE', '🎨', null, 69),
  ('Снаряжение', 'Досуг', 'expense', '#22D3EE', '🎒', null, 70),
  ('Развлечения', 'Досуг', 'expense', '#22D3EE', '🎲', null, 71),
  ('Отпуск', 'Досуг', 'expense', '#22D3EE', '🏖️', null, 72),

  ('Парикмахерская и барбер', 'Личное', 'expense', '#C084FC', '💈', null, 73),
  ('Косметика и уход', 'Личное', 'expense', '#C084FC', '🧴', null, 74),
  ('Маникюр', 'Личное', 'expense', '#C084FC', '💅', null, 75),
  ('Массаж', 'Личное', 'expense', '#C084FC', '💆', null, 76),
  ('Одежда для спорта', 'Личное', 'expense', '#C084FC', '🩳', null, 77),

  ('Курсы', 'Образование', 'expense', '#60A5FA', '🎓', null, 78),
  ('Обучение', 'Образование', 'expense', '#60A5FA', '📘', null, 79),
  ('Репетиторы', 'Образование', 'expense', '#60A5FA', '🧑‍🏫', null, 80),
  ('Книги и учебники', 'Образование', 'expense', '#60A5FA', '📖', null, 81),
  ('Конференции', 'Образование', 'expense', '#60A5FA', '🎟️', null, 82),

  ('Подарки', 'Подарки и помощь', 'expense', '#F97316', '🎁', null, 83),
  ('Цветы', 'Подарки и помощь', 'expense', '#F97316', '💐', null, 84),
  ('Благотворительность', 'Подарки и помощь', 'expense', '#F97316', '🤝', null, 85),
  ('Помощь родным', 'Подарки и помощь', 'expense', '#F97316', '❤️', null, 86),

  ('Комиссии банка', 'Финансы', 'expense', '#94A3B8', '🏦', null, 87),
  ('Проценты по кредитам', 'Финансы', 'expense', '#94A3B8', '📉', null, 88),
  ('Налоги', 'Финансы', 'expense', '#94A3B8', '🧮', null, 89),
  ('Страховки', 'Финансы', 'expense', '#94A3B8', '📄', null, 90),
  ('Штрафы и пени', 'Финансы', 'expense', '#94A3B8', '⚖️', null, 91),

  ('Непредвиденное', 'Прочее', 'expense', '#64748B', '❓', null, 92),
  ('Наличные без категории', 'Прочее', 'expense', '#64748B', '💸', null, 93),
  ('Другое', 'Прочее', 'expense', '#64748B', '📌', null, 94),
  ('Нераспознанное', 'Прочее', 'expense', '#64748B', '🕵️', 'unrecognized-expense', 95),

  ('Зарплата', 'Доход', 'income', '#4ADE80', '💰', 'salary', 96),
  ('Премия', 'Доход', 'income', '#4ADE80', '🏆', null, 97),
  ('Аванс', 'Доход', 'income', '#4ADE80', '📅', null, 98),
  ('Отпускные', 'Доход', 'income', '#4ADE80', '🌴', null, 99),
  ('Фриланс', 'Доход', 'income', '#4ADE80', '💼', null, 100),
  ('Проценты по вкладу', 'Доход', 'income', '#4ADE80', '🏦', 'interest-income', 101),
  ('Кэшбэк и бонусы', 'Доход', 'income', '#4ADE80', '🎯', null, 102),
  ('Возврат покупок', 'Доход', 'income', '#4ADE80', '↩️', null, 103),
  ('Продажа вещей', 'Доход', 'income', '#4ADE80', '🏷️', null, 104),
  ('Подарки и прочие поступления', 'Доход', 'income', '#4ADE80', '🎀', null, 105),
  ('Нераспознанный доход', 'Доход', 'income', '#4ADE80', '🕵️', 'unrecognized-income', 106),
  ('Прочие поступления', 'Доход', 'income', '#4ADE80', '➕', null, 107);
