#### Created and Maintained by Roney Dsilva

# Redis Tools <img src="https://github.com/seanyeh/fontawesome-svgs/raw/master/svg/database-solid.svg" width="30" height="30" alt="Redis Tools">

This repository contains a set of Redis-related tools for various operations, including data insertion, data retrieval, checking the Redis server's status, and inserting log data into Redis. These tools are designed to be used in Node.js applications.

## Table of Contents

- [Redis Insert Data](#redis-insert-data)
- [Redis Fetch Data](#redis-fetch-data)
- [Check Redis](#check-redis)
- [Redis Insert Log](#redis-insert-log)

## Redis Insert Data <img src="https://github.com/seanyeh/fontawesome-svgs/raw/master/svg/upload-solid.svg" width="30" height="30" alt="Redis Insert Data Icon">

### Description

This tool allows you to insert data into a Redis database.

### Input Parameters

- **Name**: A unique name for this operation.
- **Key**: The key under which the data should be inserted in Redis.
- **Data**: The data to be inserted into Redis.

### Output

- **Output**: A boolean indicating the success of the operation.

## Redis Fetch Data <img src="https://github.com/seanyeh/fontawesome-svgs/raw/master/svg/download-solid.svg" width="30" height="30" alt="Redis Insert Data Icon">

### Description

This tool allows you to fetch data from a Redis database.

### Input Parameters

- **Name**: A unique name for this operation.
- **Key**: The key from which data should be retrieved in Redis.

### Output

- **Output**: The retrieved data from Redis.

## Check Redis <img src="https://github.com/seanyeh/fontawesome-svgs/raw/master/svg/heartbeat-solid.svg" width="30" height="30" alt="Check Redis Icon">

### Description

This tool allows you to check the status of a Redis server.

### Input Parameters

- **Name**: A unique name for this operation.
- **Timeout**: Timeout in milliseconds for the server check.

### Output

- **Output**: A boolean indicating the availability of the Redis server.

## Redis Insert Log <img src="https://github.com/seanyeh/fontawesome-svgs/raw/master/svg/save-solid.svg" width="30" height="30" alt="Redis Insert Log Icon">

### Description

This tool allows you to insert log data into a Redis database.

### Input Parameters

- **Name**: A unique name for this operation.
- **Key**: The key under which the log data should be inserted in Redis.
- **Timestamp**: Timestamp for the log entry.
- **Log Level**: The log level.
- **ID**: The ID for grouping events.
- **Event**: Event description.
- **Type**: Type or action name of the event.
- **User ID**: User ID from the provider.
- **Message**: The log message.
- **Domain**: Domain name.
- **System**: System type.
- **Message Context**: Additional details as a JSON object.

### Output

- **Output**: A boolean indicating the success of the log insertion.

