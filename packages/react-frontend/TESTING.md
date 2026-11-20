## Testing Tools
Unit/System testing - Jest
UI Testing - Vitest
Component Testing - React testing Library

## Dependency Installation
cd Team-3100
npm install

## Running tests
cd packages/react-frontend
npm test

## Testing levels

# Unit Testing
Search Logic - Equivalent terms give consistent results
    Ex: "2% milk" and "two-percent milk"
    search.test.js
Product Categories - Related products are correctly categorized
    Ex: "Whole Milk" and "Oat Milk" fall under milk
    dietary.test.js
Store Finder - Stores are found up to and including the max distance
    Ex: Stores exactly 5.0 miles away are included, above aren't
    geo.test.js

# System Testing
Complete Search Logic - Searching for a product finds the correct product and nearest location
    Ex: "Searching for eggs finds the nearest store that carries eggs"
    system_tests.js

# UI Testing
Item Search - UI allows user to search for an item
    Ex: "User can search for and select Bananas"
    ui_tests.js
Price Comparison - UI allows user to compare individual item prices
    Ex: "User can compare prices for bananas between stores"
    ui_tests.js

# Test-Driven Development
The primary example of TDD wfor the search logic implemented by our team
Red: test("finds 2% milk regardless of word order, filler words, or a typo")...
Green: Implemented the functionality for various search terms to work for the same item
Refactor: Cleaned up the code to be more readble, commenting, etc.

# Limitations / Future Tests
- UI tests only cover grocery search and price comparison
- Tests primarily use mock data, not end-to-end
- Backend API integration could have future tests
- Could all test for price calc and utility functions
- Tests for shopping-list creation and updates in the future

