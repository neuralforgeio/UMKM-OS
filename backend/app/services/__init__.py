"""Service layer — business and ML logic with no I/O of its own.

Services receive plain data from the API routes and return plain data
back. Anything that touches the database lives in app/db, anything
that speaks HTTP lives in app/api — services stay pure and testable.
"""
