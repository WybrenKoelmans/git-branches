# git-branches

## Requirements
- NodeJS (v12 supported, others might work too)
- Yarn

## Installation
1. Check out repository
2. Copy `.env.dist` to `.env` and setup the required values
3. run `yarn`
4. run `npm start`
5. inspect the output for remote branches you should remove

## Known issues
- NodeGIT seems to not prune branches on fetch right now, so you might have to manually prune the remote branches
