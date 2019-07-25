require('dotenv').config();
const Hapi = require('@hapi/hapi');
const Mongoose = require('mongoose');
const Joi = require('@hapi/joi');

let host = process.env.APP_HOST || 'localhost';
let port = process.env.APP_PORT || 5000;

//connection
const Server = new Hapi.Server(
    {
        host,
        port
    }
);

//setting mongo 
Mongoose.connect(`mongodb://${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 27017}/api`, { useNewUrlParser: true });
Mongoose.set('useFindAndModify', false);

const HeroesModel = Mongoose.model('heroes', {
    name: String,
    avatar: {
        name: String,
        mime: String,
        binary: String
    },
    vitality: Number,
    strength: Number,
    agility: Number,
    intelligence: Number,
    abilities: [{ name: String, description: String }]
});


//routes
Server.route({
    method: 'POST',
    path: '/heroes',
    options: {
        payload: {
            output: 'stream',
            parse: true,
            allow: 'multipart/form-data'
        }
    },
    handler: async (request, send) => {
        let { payload } = request;
        payload = payloadValidation(payload);

        if (payload.isJoi) {
            return send.response(payload).code(400);
        }

        try {
            let hero = new HeroesModel(payload);
            let result = await hero.save();
            return send.response(result);
        } catch (error) {
            console.log(error);
            return send.response({ error }).code(500);
        }

    }
})

Server.route({
    method: 'GET',
    path: '/heroes',
    handler: async (request, send) => {
        try {
            let result = await HeroesModel.find().exec();
            return send.response(result);
        } catch (error) {
            console.log(error);
            return send.response({ error }).code(500);
        }

    }
})

Server.route({
    method: 'GET',
    path: '/heroes/{id}',
    handler: async (request, send) => {
        if (!Mongoose.Types.ObjectId.isValid(request.params.id)) {
            return send.response({ error: 'ValidationError', message: 'Invalid id' }).code(400);
        }

        try {
            let result = await HeroesModel.findById(request.params.id).exec();
            return send.response(result);
        } catch (error) {
            console.log(error);
            return send.response({ error }).code(500);
        }

    }
})

Server.route({
    method: 'PATCH',
    path: '/heroes/{id}',
    handler: async (request, send) => {
        let { payload, params } = request;

        if (!Mongoose.Types.ObjectId.isValid(params.id)) {
            return send.response({ error: 'ValidationError', message: 'Invalid id' }).code(400);
        }

        payload = payloadValidation(payload);

        if (payload.isJoi) {
            return send.response(payload).code(400);
        }

        try {
            let result = await HeroesModel.findByIdAndUpdate(params.id, payload, { new: true }).exec();
            return send.response(result);
        } catch (error) {
            console.log(error);
            return send.response({ error }).code(500);
        }

    }
})

Server.route({
    method: 'PUT',
    path: '/heroes/{id}',
    handler: async (request, send) => {
        let { payload, params } = request;

        if (!Mongoose.Types.ObjectId.isValid(params.id)) {
            return send.response({ error: 'ValidationError', message: 'Invalid id' }).code(400);
        }

        payload = payloadValidation(payload);

        if (payload.isJoi) {
            return send.response(payload).code(400);
        }

        try {
            let result = await HeroesModel.findOneAndReplace(params.id, payload, { new: true }).exec();
            return send.response(result);
        } catch (error) {
            console.log(error);
            return send.response({ error }).code(500);
        }

    }
})

Server.route({
    method: 'DELETE',
    path: '/heroes/{id}',
    handler: async (request, send) => {
        if (!Mongoose.Types.ObjectId.isValid(request.params.id)) {
            return send.response({ error: 'ValidationError', message: 'Invalid id' }).code(400);
        }

        try {
            let result = await HeroesModel.findByIdAndDelete(request.params.id).exec();
            return send.response(result);
        } catch (error) {
            console.log(error);
            return send.response({ error }).code(500);
        }

    }
})


Server.route({
    method: 'GET',
    path: '/heroes/avatar/{id}',
    handler: async (request, send) => {
        if (!Mongoose.Types.ObjectId.isValid(request.params.id)) {
            return send.response({ error: 'ValidationError', message: 'Invalid id' }).code(400);
        }

        try {
            let [result] = await HeroesModel.findById(request.params.id).distinct("avatar").exec();

            if (result) {
                let buffer = Buffer.from(result.binary, 'base64');
                return send.response(buffer).type(result.type).bytes(buffer.length);
            }

            return send.response().code(204);
        } catch (error) {
            console.log(error);
            return send.response({ error }).code(500);
        }

    }
})

//construct file object
const buildAvatar = avatar => ({ name: avatar.hapi.filename, mime: avatar.hapi.headers['content-type'], binary: avatar._data.toString('base64') })

const payloadValidation = payload => {

    if (payload.abilities) {
        payload = { ...payload, abilities: payload.abilities.map(JSON.parse) }
    }

    if (payload.avatar) {
        payload = { ...payload, avatar: buildAvatar(payload.avatar) }
    }

    //field validation
    let schema = Joi.object().keys({
        name: Joi.string(),
        vitality: Joi.number().integer().min(0).max(100),
        strength: Joi.number().integer().min(0).max(100),
        agility: Joi.number().integer().min(0).max(100),
        intelligence: Joi.number().integer().min(0).max(100),
        abilities: Joi.array().items({
            name: Joi.string(),
            description: Joi.string()
        }),
        avatar: Joi.object().keys({
            name: Joi.string(),
            mime: Joi.string(),
            binary: Joi.string()
        })
    })

    const { error } = Joi.validate(payload, schema);
    if (error) {
        return { error: error.name, message: error.message, isJoi: error.isJoi };
    }

    return payload;
}


process.on('unhandledRejection', (error) => {
    console.log(error);
    process.exit(1);
});

const start = async () => {
    await Server.start();
    console.log(`Server is running on ${host}:${port}`);
};

start();