'use strict';

	/*
	|--------------------------------------------------------------------------
	| users Model v1.0
	|--------------------------------------------------------------------------
	| Author : Shinji Escorido
	|
	*/

module.exports = (sequelize, DataTypes) => {  
	const Users = sequelize.define('user', {
		id : {
			type          : DataTypes.INTEGER(10).UNSIGNED,
			primaryKey    : true,
			autoIncrement : true
		},
		vender_id : {
			type : DataTypes.INTEGER(10).UNSIGNED,
			allowNull: false
		},
		user_id : {
			allowNull: false,
			type : DataTypes.STRING(20)
		},
		user_name : {
			allowNull: false,
			type : DataTypes.STRING(60)
		},
		password : {
			allowNull: false,
			type : DataTypes.STRING(255)
		},
		money : {
			allowNull: false,
			type : DataTypes.DOUBLE(15,2)
		},
		is_active : {
			allowNull: true,
			type : DataTypes.ENUM,
			values : ['0','1']
		
		},
		is_online : {
			allowNull: true,
			type : DataTypes.ENUM,
			values : ['0','1']
		},
		user_type : {
			type : DataTypes.ENUM,
			values: ['TC','TS','C','S'],
			defaultValue : null
		},
		currency : {
			allowNull: true,
			type : DataTypes.ENUM,
			values: ['CNY','USD','JPY','KRW','THB','MYR','IDR'],
			defaultValue : null
		},
		created_country : {
			type: DataTypes.STRING(60),
			defaultValue : null
		},
		connect_country : {
			type: DataTypes.STRING(60),
			defaultValue : null
		},
		configs : {
			type: DataTypes.STRING(512),
			allowNull : false
		},
		connect_ip : {
			type: DataTypes.STRING(15),
			allowNull : false
		},
		created_ip : {
			type: DataTypes.STRING(15),
			allowNull : false
		},
		deleted_at : {
			type: DataTypes.DATE,
			defaultValue : null
		},
		denomination : {
			type: DataTypes.INTEGER(10),
			allowNull: true,
			defaultValue: 8
		}
	});
	return Users;
}
