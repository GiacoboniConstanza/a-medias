begin;
select plan(9);

select hasnt_table('public', 'savings_funds', 'savings_funds ya no existe');
select hasnt_table('public', 'shared_goals', 'shared_goals ya no existe');
select hasnt_table('public', 'goal_contributions', 'goal_contributions ya no existe');
select hasnt_table('public', 'bag_movements', 'bag_movements ya no existe');
select hasnt_table('public', 'extra_allocations', 'extra_allocations ya no existe');
select hasnt_function('public', 'replace_active_shared_goal', 'replace_active_shared_goal ya no existe');
select hasnt_function('private', 'sync_bag_movement', 'sync_bag_movement ya no existe');
select hasnt_function('private', 'validate_bag_movement', 'validate_bag_movement ya no existe');
select hasnt_table('public', 'monthly_incomes', 'monthly_incomes ya no existe');

select * from finish();
rollback;
