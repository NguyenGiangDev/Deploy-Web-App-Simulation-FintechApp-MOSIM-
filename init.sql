-- Database cho Charge
CREATE DATABASE wallet_charge;
\connect wallet_charge;

CREATE TABLE IF NOT EXISTS charge (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    amount NUMERIC NOT NULL
);

-- Database cho History
CREATE DATABASE wallet_history;
\connect wallet_history;

CREATE TABLE IF NOT EXISTS history (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    bank VARCHAR(100) NOT NULL,
    transaction_time TIMESTAMP NOT NULL
);

-- Database cho Transaction
CREATE DATABASE wallet_transaction;
\connect wallet_transaction;

CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    from_user VARCHAR(100) NOT NULL,
    to_user VARCHAR(100) NOT NULL,
    from_phone_number VARCHAR(20) NOT NULL,
    to_phone_number VARCHAR(20) NOT NULL,
    amount NUMERIC NOT NULL,
    transaction_realtime TIMESTAMP NOT NULL
);
